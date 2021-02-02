/* eslint-disable @typescript-eslint/no-non-null-assertion */
import "./init"
import { Amm } from "../types/ethers"
import { ERC20Service } from "./ERC20Service"
import { EthMetadata, SystemMetadataFactory } from "./SystemMetadataFactory"
import { EthService } from "./EthService"
import { FtxService, Position as FTXPosition, PlaceOrderPayload } from "./FtxService"
import { isNumber } from "lodash"
import { Log } from "./Log"
import { MaxUint256 } from "@ethersproject/constants"
import { Mutex } from "async-mutex"
import { parseBytes32String } from "@ethersproject/strings"
import { PerpService, Side, Position } from "./PerpService"
import { Runtime } from "../scripts/helper"
import { ServerProfile } from "./ServerProfile"
import { Service } from "typedi"
import { sleep } from "./util"
import { Wallet } from "ethers"
import Big from "big.js"
import FTXRest from "ftx-api-rest"

interface AmmConfig {
    ENABLED: boolean
    ASSET_CAP: Big
    PERPFI_MIN_TRADE_NOTIONAL: Big
    MAX_SLIPPAGE_RATIO: Big
    PERPFI_SHORT_ENTRY_TRIGGER: Big
    PERPFI_LONG_ENTRY_TRIGGER: Big
    FTX_MARKET_ID: string
    FTX_SIZE_DIFF_THRESHOLD: Big
}

@Service()
export class Arbitrageur {
    private readonly log = Log.getLogger(Arbitrageur.name)
    private readonly XDAI_BALANCE_WARNING_THRESHOLD = Big(1)
    private readonly QUOTE_BALANCE_REFILL_THRESHOLD = Big(500)
    private readonly PERP_LEVERAGE = Big(5)
    private readonly FTX_USD_BALANCE_WARNING_THRESHOLD = Big(500)
    private readonly FTX_MARGIN_RATIO_WARNING_THRESHOLD = Big(0.1) // 10%
    private readonly PERP_FEE = Big(0.001) // 0.1%
    private readonly AMM_CONFIG_MAP: Record<string, AmmConfig> = {
        "BTC-USDC": {
            ENABLED: true,
            MAX_SLIPPAGE_RATIO: Big(0.0001),
            PERPFI_SHORT_ENTRY_TRIGGER: Big(0.5).div(100),
            PERPFI_LONG_ENTRY_TRIGGER: Big(-0.5).div(100),
            FTX_MARKET_ID: "BTC-PERP",
            ASSET_CAP: Big(1000),
            PERPFI_MIN_TRADE_NOTIONAL: Big(100),
            FTX_SIZE_DIFF_THRESHOLD: Big(0.0001),
        },
        "ETH-USDC": {
            ENABLED: true,
            MAX_SLIPPAGE_RATIO: Big(0.0001),
            PERPFI_SHORT_ENTRY_TRIGGER: Big(0.5).div(100),
            PERPFI_LONG_ENTRY_TRIGGER: Big(-0.5).div(100),
            FTX_MARKET_ID: "ETH-PERP",
            ASSET_CAP: Big(1000),
            PERPFI_MIN_TRADE_NOTIONAL: Big(100),
            FTX_SIZE_DIFF_THRESHOLD: Big(0.001),
        },
        "YFI-USDC": {
            ENABLED: true,
            MAX_SLIPPAGE_RATIO: Big(0.0001),
            PERPFI_SHORT_ENTRY_TRIGGER: Big(0.5).div(100),
            PERPFI_LONG_ENTRY_TRIGGER: Big(-0.5).div(100),
            FTX_MARKET_ID: "YFI-PERP",
            ASSET_CAP: Big(1000),
            PERPFI_MIN_TRADE_NOTIONAL: Big(100),
            FTX_SIZE_DIFF_THRESHOLD: Big(0.001),
        },
        "DOT-USDC": {
            ENABLED: true,
            MAX_SLIPPAGE_RATIO: Big(0.0001),
            PERPFI_SHORT_ENTRY_TRIGGER: Big(0.5).div(100),
            PERPFI_LONG_ENTRY_TRIGGER: Big(-0.5).div(100),
            FTX_MARKET_ID: "DOT-PERP",
            ASSET_CAP: Big(1000),
            PERPFI_MIN_TRADE_NOTIONAL: Big(100),
            FTX_SIZE_DIFF_THRESHOLD: Big(0.1),
        },
        "SNX-USDC": {
            ENABLED: true,
            MAX_SLIPPAGE_RATIO: Big(0.0001),
            PERPFI_SHORT_ENTRY_TRIGGER: Big(0.5).div(100),
            PERPFI_LONG_ENTRY_TRIGGER: Big(-0.5).div(100),
            FTX_MARKET_ID: "SNX-PERP",
            ASSET_CAP: Big(1000),
            PERPFI_MIN_TRADE_NOTIONAL: Big(100),
            FTX_SIZE_DIFF_THRESHOLD: Big(0.1),
        },
    }

    private readonly arbitrageur: Wallet
    private readonly nonceMutex = new Mutex()
    private nextNonce!: number

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    private readonly ftxClient!: any
    private ftxPositionsMap!: Record<string, FTXPosition>

    constructor(
        readonly perpService: PerpService,
        readonly erc20Service: ERC20Service,
        readonly ethService: EthService,
        readonly serverProfile: ServerProfile,
        readonly systemMetadataFactory: SystemMetadataFactory,
        readonly ftxService: FtxService,
    ) {
        this.arbitrageur = ethService.privateKeyToWallet(serverProfile.arbitrageurPK)
        this.ftxClient = new FTXRest({
            key: this.serverProfile.ftxApiKey,
            secret: this.serverProfile.ftxApiSecret,
            // subaccount: "arb", // Uncomment this line if you're using a subaccount for FTX
        })
    }

    async start(runtime: Runtime): Promise<void> {
        this.nextNonce = await this.arbitrageur.getTransactionCount()
        this.log.jinfo({
            event: "Start",
            params: {
                arbitrageur: this.arbitrageur.address,
                nextNonce: this.nextNonce,
            },
        })

        if (runtime === "cli") {
            await this.arbitrage()
            setInterval(async () => await this.arbitrage(), 1000 * 60 * 1) // 1 minute
        } else {
            await this.arbitrage()
        }
    }

    async arbitrage(): Promise<void> {
        // Check xDai balance
        const xDaiBalance = await this.ethService.getBalance(this.arbitrageur.address)
        this.log.jinfo({
            event: "xDaiBalance",
            params: { balance: xDaiBalance.toFixed() },
        })
        if (xDaiBalance.lt(this.XDAI_BALANCE_WARNING_THRESHOLD)) {
            this.log.jwarn({
                event: "xDaiNotEnough",
                params: { balance: xDaiBalance.toFixed() },
            })
            return
        }

        // Check FTX balance (USD)
        const ftxBalance = await this.ftxService.getBalanceUsd(this.ftxClient)
        this.log.jinfo({
            event: "FtxUsdBalance",
            params: { balance: ftxBalance.free.toFixed() },
        })
        if (ftxBalance.free.lt(this.FTX_USD_BALANCE_WARNING_THRESHOLD)) {
            this.log.jerror({
                event: "FtxUsdNotEnough",
                params: { balance: ftxBalance.free.toFixed() },
            })
            return
        }

        // Check FTX margin ratio
        const ftxAccountInfo = await this.ftxService.getAccountInfo(this.ftxClient)
        const ftxMarginRatio = ftxAccountInfo.marginFraction
        this.log.jinfo({
            event: "FtxMarginRatio",
            params: { balftxMarginRatioance: ftxMarginRatio.toFixed() },
        })
        if (!ftxMarginRatio.eq(0) && ftxMarginRatio.lt(this.FTX_MARGIN_RATIO_WARNING_THRESHOLD)) {
            this.log.jerror({
                event: "FtxMarginRatioTooLow",
                params: { balance: ftxMarginRatio.toFixed() },
            })
            return
        }

        // Fetch FTX owned positions
        this.ftxPositionsMap = await this.ftxService.getPositions(this.ftxClient)

        // Check all Amms
        const systemMetadata = await this.systemMetadataFactory.fetch()
        const amms = await this.perpService.getAllOpenAmms()

        await Promise.all(
            amms.map(async amm => {
                try {
                    return await this.arbitrageAmm(amm, systemMetadata)
                } catch (e) {
                    this.log.jerror({
                        event: "ArbitrageAmmFailed",
                        params: {
                            reason: e.toString(),
                            stackTrace: e.stack,
                        },
                    })
                    return
                }
            }),
        )
    }

    async arbitrageAmm(amm: Amm, systemMetadata: EthMetadata): Promise<void> {
        const ammPair = await this.getAmmPair(amm.address)
        const ammConfig = this.AMM_CONFIG_MAP[ammPair]
        
        if (!ammConfig) {
            this.log.jinfo({
                event: "AmmConfigMissing",
                params: {
                    amm: amm.address,
                    ammPair,
                },
            })
            return
        }

        if (!ammConfig.ENABLED) {
            this.log.jwarn({
                event: "DisabledAmm",
                params: {
                    amm: amm.address,
                    ammPair,
                    ammConfig,
                },
            })
            return
        }

        this.log.jinfo({
            event: "ArbitrageAmm",
            params: {
                amm: amm.address,
                ammConfig,
                ammPair,
            },
        })

        const arbitrageurAddr = this.arbitrageur.address
        const clearingHouseAddr = systemMetadata.clearingHouseAddr
        const quoteAssetAddr = await amm.quoteAsset()

        // Check PERP balance
        const quoteBalance = await this.erc20Service.balanceOf(quoteAssetAddr, arbitrageurAddr)
        if (quoteBalance.lt(this.QUOTE_BALANCE_REFILL_THRESHOLD)) {
            this.log.jwarn({
                event: "QuoteAssetNotEnough",
                params: { balance: quoteBalance.toFixed() },
            })
            // NOTE we don't abort prematurely here because we don't know yet which direction
            // the arbitrageur will go. If it's the opposite then it doesn't need more quote asset to execute
        }

        // Make sure the quote asset are approved
        const allowance = await this.erc20Service.allowance(quoteAssetAddr, arbitrageurAddr, clearingHouseAddr)
        const infiniteAllowance = await this.erc20Service.fromScaled(quoteAssetAddr, MaxUint256)
        const allowanceThreshold = infiniteAllowance.div(2)
        if (allowance.lt(allowanceThreshold)) {
            await this.erc20Service.approve(quoteAssetAddr, clearingHouseAddr, infiniteAllowance, this.arbitrageur, {
                gasPrice: await this.ethService.getSafeGasPrice(),
            })
            this.log.jinfo({
                event: "SetMaxAllowance",
                params: {
                    quoteAssetAddr: quoteAssetAddr,
                    owner: this.arbitrageur.address,
                    agent: clearingHouseAddr,
                },
            })
        }

        // List PERP AMM's properties
        const priceFeedKey = parseBytes32String(await amm.priceFeedKey())
        const ammProps = await this.perpService.getAmmStates(amm.address)
        const ammPrice = ammProps.quoteAssetReserve.div(ammProps.baseAssetReserve)
        this.log.jinfo({
            event: "AmmStatusBefore",
            params: {
                amm: amm.address,
                priceFeedKey,
                baseAssetReserve: ammProps.baseAssetReserve.toFixed(),
                quoteAssetReserve: ammProps.quoteAssetReserve.toFixed(),
                price: ammPrice.toFixed(),
            },
        })

        // List PERP position
        const position = await this.perpService.getPosition(amm.address, this.arbitrageur.address)
        const perpfiPositionSize = position.size
        this.log.jinfo({
            event: "PerpFiPosition",
            params: {
                amm: amm.address,
                priceFeedKey,
                size: +perpfiPositionSize,
                margin: +position.margin,
                openNotional: +position.openNotional,
            },
        })
        
        // List FTX position
        const ftxPosition = this.ftxPositionsMap[ammConfig.FTX_MARKET_ID]
        if (ftxPosition) {
            const ftxPositionSize = ftxPosition.netSize
            const ftxSizeDiff = ftxPositionSize.abs().sub(perpfiPositionSize.abs())
            this.log.jinfo({
                event: "FtxPosition",
                params: {
                    marketId: ftxPosition.future,
                    size: +ftxPositionSize,
                    diff: +ftxSizeDiff,
                },
            })
    
            if (ftxSizeDiff.abs().gte(ammConfig.FTX_SIZE_DIFF_THRESHOLD)) {
                let side = null
                if (ftxPositionSize.gte(Big(0))) {
                    // FTX owns long positions
                    if (ftxSizeDiff.gte(Big(0))) {
                        // FTX longs too much
                        side = Side.SELL
                    } else {
                        // FTX long too little
                        side = Side.BUY
                    }
                } else {
                    // FTX owns short positions
                    if (ftxSizeDiff.gte(Big(0))) {
                        // FTX shorts too much
                        side = Side.BUY
                    } else {
                        // FTX shorts too little
                        side = Side.SELL
                    }
                }
                if (isNumber(side)) {
                    this.log.jinfo({
                        event: "MitigateFTXPositionSizeDiff",
                        params: {
                            perpfiPositionSize,
                            ftxPositionSize,
                            ftxSizeDiff,
                            side,
                        },
                    })
                    await this.openFTXPosition(ammConfig.FTX_MARKET_ID, ftxSizeDiff.abs(), side)
                }
            }
        }

        // NOTE If the arbitrageur is already imbalanced,
        // we will leave it as is and not do any rebalance work

        // Get FTX price right before calculating the spread
        const ftxMarket = await this.ftxService.getMarket(ammConfig.FTX_MARKET_ID)
        const ftxPrice = ftxMarket.last!
        this.log.jinfo({
            event: "FtxPrice",
            params: {
                tokenPair: ammConfig.FTX_MARKET_ID,
                price: ftxPrice.toFixed(),
            },
        })

        // Calculate spread
        // NOTE Note that we assume FTX liquidity is always larger than perp.fi,
        // so we can use perp.fi to calculate the max slippage
        const spread = ammPrice.sub(ftxPrice).div(ftxPrice)
        const amount = Arbitrageur.calcMaxSlippageAmount(
            ammPrice,
            ammConfig.MAX_SLIPPAGE_RATIO,
            ammProps.baseAssetReserve,
            ammProps.quoteAssetReserve,
        )

        this.log.jinfo({
            event: "CalculatedSpread",
            params: {
                spread: spread.toFixed(),
                amount: amount.toFixed(),
                baseAssetSymbol: priceFeedKey,
            },
        })

        // Open positions if needed
        if (position.size.gte(0) && spread.lt(ammConfig.PERPFI_LONG_ENTRY_TRIGGER)) {
            const regAmount = this.calculateRegulatedPositionNotional(
                ammConfig,
                quoteBalance,
                amount,
                position,
                Side.BUY,
            )
            const ftxPositionSizeAbs = regAmount
                .div(ftxPrice)
                .abs()
                .round(3) // round to FTX decimals
            if (ftxPositionSizeAbs.eq(Big(0))) {
                return
            }

            await Promise.all([
                this.openFTXPosition(ammConfig.FTX_MARKET_ID, ftxPositionSizeAbs, Side.SELL),
                this.openPerpFiPosition(amm, priceFeedKey, regAmount.div(this.PERP_LEVERAGE), Side.BUY),
            ])
        } else if (position.size.lte(0) && spread.gt(ammConfig.PERPFI_SHORT_ENTRY_TRIGGER)) {
            const regAmount = this.calculateRegulatedPositionNotional(
                ammConfig,
                quoteBalance,
                amount,
                position,
                Side.SELL,
            )
            const ftxPositionSizeAbs = regAmount
                .div(ftxPrice)
                .abs()
                .round(3) // round to FTX decimals
            if (ftxPositionSizeAbs.eq(Big(0))) {
                return
            }

            await Promise.all([
                this.openFTXPosition(ammConfig.FTX_MARKET_ID, ftxPositionSizeAbs, Side.BUY),
                this.openPerpFiPosition(amm, priceFeedKey, regAmount.div(this.PERP_LEVERAGE), Side.SELL),
            ])
        }
        // Open reversed positions if needed. Don't need to refetch the position again because the position won't be reduced.
        else if (position.size.gt(0) && spread.gt(ammConfig.PERPFI_SHORT_ENTRY_TRIGGER)) {
            const regAmount = this.calculateRegulatedPositionNotional(
                ammConfig,
                quoteBalance,
                amount,
                position,
                Side.SELL,
            )
            const ftxPositionSizeAbs = regAmount
                .div(ftxPrice)
                .abs()
                .round(3) // round to FTX decimals
            if (ftxPositionSizeAbs.eq(Big(0))) {
                return
            }

            await Promise.all([
                this.openFTXPosition(ammConfig.FTX_MARKET_ID, ftxPositionSizeAbs, Side.BUY),
                this.openPerpFiPosition(amm, priceFeedKey, regAmount.div(this.PERP_LEVERAGE), Side.SELL),
            ])
        } else if (position.size.lt(0) && spread.lt(ammConfig.PERPFI_LONG_ENTRY_TRIGGER)) {
            const regAmount = this.calculateRegulatedPositionNotional(
                ammConfig,
                quoteBalance,
                amount,
                position,
                Side.BUY,
            )
            const ftxPositionSizeAbs = regAmount
                .div(ftxPrice)
                .abs()
                .round(3) // round to FTX decimals
            if (ftxPositionSizeAbs.eq(Big(0))) {
                return
            }

            await Promise.all([
                this.openFTXPosition(ammConfig.FTX_MARKET_ID, ftxPositionSizeAbs, Side.SELL),
                this.openPerpFiPosition(amm, priceFeedKey, regAmount.div(this.PERP_LEVERAGE), Side.BUY),
            ])
        } else {
            this.log.jinfo({
                event: "NotTriggered",
                params: {
                    ammConfig
                },
            })
        }
    }

    async getAmmPair(ammAddr: string): Promise<string> {
        const ammState = await this.perpService.getAmmStates(ammAddr)
        return `${ammState.baseAssetSymbol}-${ammState.quoteAssetSymbol}`
    }

    calculateRegulatedPositionNotional(
        ammConfig: AmmConfig,
        quoteBalance: Big,
        maxSlippageAmount: Big,
        position: Position,
        side: Side,
    ): Big {
        let maxOpenNotional = Big(0)

        // asset cap >> 1000
        // perpfi position + >> 500
        // perpfi short - >> 1500 maximum
        // max_opennotional = opennotional + asset_cap
        if (position.size.gte(0) && side == Side.SELL) {
            maxOpenNotional = position.openNotional.add(ammConfig.ASSET_CAP)
        }

        // perpfi position -
        // perpfi long it
        // max_opennotional = opennotional + asset_cap
        else if (position.size.lte(0) && side == Side.BUY) {
            maxOpenNotional = position.openNotional.add(ammConfig.ASSET_CAP)
        }

        // perpfi position +
        // perpfi long it
        // max_opennotional = asset_cap - opennotional
        else if (position.size.gte(0) && side == Side.BUY) {
            maxOpenNotional = ammConfig.ASSET_CAP.sub(position.openNotional)
            if (maxOpenNotional.lt(0)) {
                maxOpenNotional = Big(0)
            }
        }

        // perpfi position -
        // perpfi short it
        // max_opennotional = asset_cap - opennotional
        else if (position.size.lte(0) && side == Side.SELL) {
            maxOpenNotional = ammConfig.ASSET_CAP.sub(position.openNotional)
            if (maxOpenNotional.lt(0)) {
                maxOpenNotional = Big(0)
            }
        }

        let amount = maxSlippageAmount
        if (amount.gt(maxOpenNotional)) {
            amount = maxOpenNotional
            this.log.jinfo({
                event: "AmountPerpFiExceedCap",
                params: {
                    ammConfig,
                    side,
                    size: +position.size,
                    openNotional: +position.openNotional,
                    maxSlippageAmount: +maxSlippageAmount,
                    maxOpenNotional: +maxOpenNotional,
                    amount: +amount,
                },
            })
        }

        const feeSafetyMargin = ammConfig.ASSET_CAP.mul(this.PERP_FEE).mul(3)
        if (amount.gt(quoteBalance.sub(feeSafetyMargin).mul(this.PERP_LEVERAGE))) {
            amount = quoteBalance.sub(feeSafetyMargin).mul(this.PERP_LEVERAGE)
        }

        if (amount.lt(ammConfig.PERPFI_MIN_TRADE_NOTIONAL)) {
            amount = Big(0)
            this.log.jinfo({
                event: "AmountNotReachPerpFiMinTradeNotional",
                params: {
                    ammConfig,
                    side,
                    size: +position.size,
                    openNotional: +position.openNotional,
                    maxSlippageAmount: +maxSlippageAmount,
                    maxOpenNotional: +maxOpenNotional,
                    feeSafetyMargin: +feeSafetyMargin,
                    amount: +amount,
                },
            })
        } else if (amount.eq(Big(0))) {
            this.log.jinfo({
                event: "AmountZero",
                params: {
                    ammConfig,
                    side,
                    size: +position.size,
                    openNotional: +position.openNotional,
                    maxSlippageAmount: +maxSlippageAmount,
                    maxOpenNotional: +maxOpenNotional,
                    feeSafetyMargin: +feeSafetyMargin,
                    amount: +amount,
                },
            })
        } else {
            this.log.jinfo({
                event: "AmountCalculated",
                params: {
                    ammConfig,
                    side,
                    size: +position.size,
                    openNotional: +position.openNotional,
                    maxSlippageAmount: +maxSlippageAmount,
                    maxOpenNotional: +maxOpenNotional,
                    feeSafetyMargin: +feeSafetyMargin,
                    amount: +amount,
                },
            })
        }
        return amount
    }

    static calcQuoteAssetNeeded(baseAssetReserve: Big, quoteAssetReserve: Big, price: Big): Big {
        // quoteAssetNeeded = sqrt(quoteAssetReserve * baseAssetReserve * price) - quoteAssetReserve
        const ammPrice = quoteAssetReserve.div(baseAssetReserve)
        if (ammPrice.eq(price)) return Big(0)
        return quoteAssetReserve
            .mul(baseAssetReserve)
            .mul(price)
            .sqrt()
            .minus(quoteAssetReserve)
    }

    static calcMaxSlippageAmount(ammPrice: Big, maxSlippage: Big, baseAssetReserve: Big, quoteAssetReserve: Big): Big {
        const targetAmountSq = ammPrice
            .mul(new Big(1).add(maxSlippage))
            .mul(baseAssetReserve)
            .mul(quoteAssetReserve)
        return targetAmountSq.sqrt().sub(quoteAssetReserve)
    }

    private async openPerpFiPosition(
        amm: Amm,
        baseAssetSymbol: string,
        quoteAssetAmount: Big,
        side: Side,
    ): Promise<void> {
        const gasPrice = await this.ethService.getSafeGasPrice()

        const release = await this.nonceMutex.acquire()
        let tx
        try {
            tx = await this.perpService.openPosition(
                this.arbitrageur,
                amm.address,
                side,
                quoteAssetAmount,
                this.PERP_LEVERAGE,
                Big(0),
                {
                    nonce: this.nextNonce,
                    gasPrice,
                },
            )
            this.nextNonce++
        } finally {
            release()
        }

        this.log.jinfo({
            event: "OpenPerpFiPosition",
            params: {
                amm: amm.address,
                side,
                baseAssetSymbol: baseAssetSymbol,
                quoteAssetAmount: +quoteAssetAmount,
                leverage: this.PERP_LEVERAGE.toFixed(),
                txHash: tx.hash,
                gasPrice: tx.gasPrice.toString(),
                nonce: tx.nonce,
            },
        })
        await tx.wait()

        // check AMM properties after
        const ammProps = await this.perpService.getAmmStates(amm.address)
        const ammPrice = ammProps.quoteAssetReserve.div(ammProps.baseAssetReserve)
        this.log.jinfo({
            event: "AmmStatusAfter",
            params: {
                amm: amm.address,
                priceFeedKey: ammProps.priceFeedKey,
                baseAssetReserve: ammProps.baseAssetReserve.toFixed(),
                quoteAssetReserve: ammProps.quoteAssetReserve.toFixed(),
                price: ammPrice.toFixed(),
            },
        })
    }

    private async openFTXPosition(marketId: string, positionSizeAbs: Big, side: Side): Promise<void> {
        const payload: PlaceOrderPayload = {
            market: marketId,
            side: side === Side.BUY ? "buy" : "sell",
            price: null,
            size: parseFloat(positionSizeAbs.toFixed(3)), // rounding to FTX contract decimals
            type: "market",
        }

        this.log.jinfo({
            event: "OpenFTXPosition",
            params: payload,
        })
        await this.ftxService.placeOrder(this.ftxClient, payload)

        const ftxPositionsAfter = await this.ftxService.getPositions(this.ftxClient)
        this.log.jinfo({
            event: "FtxStatusAfter",
            params: ftxPositionsAfter,
        })
    }
}

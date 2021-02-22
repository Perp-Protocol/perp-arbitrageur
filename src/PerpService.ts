import { Amm, AmmReader, ClearingHouse, ClearingHouseViewer, InsuranceFund } from "../types/ethers"
import { BigNumber } from "@ethersproject/bignumber"
import { ethers, Wallet } from "ethers"
import { EthMetadata, SystemMetadataFactory } from "./SystemMetadataFactory"
import { EthService } from "./EthService"
import { formatEther, parseEther } from "@ethersproject/units"
import { Log } from "./Log"
import { Overrides } from "@ethersproject/contracts"
import { ServerProfile } from "./ServerProfile"
import { Service } from "typedi"
import { TransactionResponse } from "@ethersproject/abstract-provider"
import AmmArtifact from "@perp/contract/build/contracts/Amm.json"
import AmmReaderArtifact from "@perp/contract/build/contracts/AmmReader.json"
import Big from "big.js"
import ClearingHouseArtifact from "@perp/contract/build/contracts/ClearingHouse.json"
import ClearingHouseViewerArtifact from "@perp/contract/build/contracts/ClearingHouseViewer.json"
import InsuranceFundArtifact from "@perp/contract/build/contracts/InsuranceFund.json"

export enum Side {
    BUY,
    SELL,
}

export enum PnlCalcOption {
    SPOT_PRICE,
    TWAP,
}

export interface Decimal {
    d: BigNumber
}

export interface AmmProps {
    priceFeedKey: string
    quoteAssetSymbol: string
    baseAssetSymbol: string
    baseAssetReserve: Big
    quoteAssetReserve: Big
}

export interface Position {
    size: Big
    margin: Big
    openNotional: Big
    lastUpdatedCumulativePremiumFraction: Big
}

export interface PositionCost {
    side: Side
    size: Big
    baseAssetReserve: Big
    quoteAssetReserve: Big
}

@Service()
export class PerpService {
    private readonly log = Log.getLogger(PerpService.name)

    constructor(
        readonly ethService: EthService,
        readonly systemMetadataFactory: SystemMetadataFactory,
        readonly serverProfile: ServerProfile,
    ) {}

    private async createInsuranceFund(): Promise<InsuranceFund> {
        return await this.createContract<InsuranceFund>(
            ethMetadata => ethMetadata.insuranceFundAddr,
            InsuranceFundArtifact.abi,
        )
    }

    private createAmm(ammAddr: string): Amm {
        return this.ethService.createContract<Amm>(ammAddr, AmmArtifact.abi)
    }

    private async createAmmReader(): Promise<AmmReader> {
        return this.createContract<AmmReader>(systemMetadata => systemMetadata.ammReaderAddr, AmmReaderArtifact.abi)
    }

    private async createClearingHouse(signer?: ethers.Signer): Promise<ClearingHouse> {
        return this.createContract<ClearingHouse>(
            systemMetadata => systemMetadata.clearingHouseAddr,
            ClearingHouseArtifact.abi,
            signer,
        )
    }

    private async createClearingHouseViewer(signer?: ethers.Signer): Promise<ClearingHouseViewer> {
        return this.createContract<ClearingHouseViewer>(
            systemMetadata => systemMetadata.clearingHouseViewerAddr,
            ClearingHouseViewerArtifact.abi,
            signer,
        )
    }

    private async createContract<T>(
        addressGetter: (systemMetadata: EthMetadata) => string,
        abi: ethers.ContractInterface,
        signer?: ethers.Signer,
    ): Promise<T> {
        const systemMetadata = await this.systemMetadataFactory.fetch()
        return this.ethService.createContract<T>(addressGetter(systemMetadata), abi, signer)
    }

    async getAllOpenAmms(): Promise<Amm[]> {
        const amms: Amm[] = []
        const insuranceFund = await this.createInsuranceFund()
        const allAmms = await insuranceFund.functions.getAllAmms()
        for (const ammAddr of allAmms[0]) {
            const amm = this.createAmm(ammAddr)
            if (await amm.open()) {
                amms.push(amm)
            }
        }

        this.log.info(
            JSON.stringify({
                event: "GetAllOpenAmms",
                params: {
                    ammAddrs: amms.map(amm => amm.address),
                },
            }),
        )
        return amms
    }

    async getAmmStates(ammAddr: string): Promise<AmmProps> {
        const ammReader = await this.createAmmReader()
        const props = (await ammReader.functions.getAmmStates(ammAddr))[0]
        return {
            priceFeedKey: props.priceFeedKey,
            quoteAssetSymbol: props.quoteAssetSymbol,
            baseAssetSymbol: props.baseAssetSymbol,
            baseAssetReserve: PerpService.fromWei(props.baseAssetReserve),
            quoteAssetReserve: PerpService.fromWei(props.quoteAssetReserve),
        }
    }

    async getPosition(ammAddr: string, traderAddr: string): Promise<Position> {
        const clearingHouse = await this.createClearingHouse()
        const position = (await clearingHouse.functions.getPosition(ammAddr, traderAddr))[0]
        return {
            size: PerpService.fromWei(position.size.d),
            margin: PerpService.fromWei(position.margin.d),
            openNotional: PerpService.fromWei(position.openNotional.d),
            lastUpdatedCumulativePremiumFraction: PerpService.fromWei(position.lastUpdatedCumulativePremiumFraction.d),
        }
    }

    async getPersonalPositionWithFundingPayment(ammAddr: string, traderAddr: string): Promise<Position> {
        const clearingHouseViewer = await this.createClearingHouseViewer()
        const position = await clearingHouseViewer.getPersonalPositionWithFundingPayment(ammAddr, traderAddr)
        return {
            size: PerpService.fromWei(position.size.d),
            margin: PerpService.fromWei(position.margin.d),
            openNotional: PerpService.fromWei(position.openNotional.d),
            lastUpdatedCumulativePremiumFraction: PerpService.fromWei(position.lastUpdatedCumulativePremiumFraction.d),
        }
    }

    async getMarginRatio(ammAddr: string, traderAddr: string): Promise<Big> {
        const clearingHouse = await this.createClearingHouse()
        return PerpService.fromWei((await clearingHouse.functions.getMarginRatio(ammAddr, traderAddr))[0].d)
    }

    async openPosition(
        trader: Wallet,
        ammAddr: string,
        side: Side,
        quoteAssetAmount: Big,
        leverage: Big,
        minBaseAssetAmount: Big = Big(0),
        overrides?: Overrides,
    ): Promise<TransactionResponse> {
        const clearingHouse = await this.createClearingHouse(trader)

        // if the tx gonna fail it will throw here
        const gasEstimate = await clearingHouse.estimateGas.openPosition(
            ammAddr,
            side.valueOf(),
            { d: PerpService.toWei(quoteAssetAmount) },
            { d: PerpService.toWei(leverage) },
            { d: PerpService.toWei(minBaseAssetAmount) },
        )

        const tx = await clearingHouse.functions.openPosition(
            ammAddr,
            side.valueOf(),
            { d: PerpService.toWei(quoteAssetAmount) },
            { d: PerpService.toWei(leverage) },
            { d: PerpService.toWei(minBaseAssetAmount) },
            {
                // add a margin for gas limit since its estimation was sometimes too tight
                gasLimit: BigNumber.from(
                    Big(gasEstimate.toString())
                        .mul(Big(1.2))
                        .toFixed(0),
                ),
                ...overrides,
            },
        )
        this.log.jinfo({
            event: "OpenPositionTxSent",
            params: {
                trader: trader.address,
                amm: ammAddr,
                side,
                quoteAssetAmount: +quoteAssetAmount,
                leverage: +leverage,
                minBaseAssetAmount: +minBaseAssetAmount,
                txHash: tx.hash,
                gasPrice: tx.gasPrice.toString(),
                nonce: tx.nonce,
            },
        })

        return tx
    }

    async closePosition(
        trader: Wallet,
        ammAddr: string,
        minBaseAssetAmount: Big = Big(0),
        overrides?: Overrides,
    ): Promise<TransactionResponse> {
        const clearingHouse = await this.createClearingHouse(trader)
        const tx = await clearingHouse.functions.closePosition(
            ammAddr,
            { d: PerpService.toWei(minBaseAssetAmount) },
            {
                gasLimit: 1_500_000,
                ...overrides,
            },
        )
        this.log.jinfo({
            event: "ClosePositionTxSent",
            params: {
                trader: trader.address,
                amm: ammAddr,
                txHash: tx.hash,
                gasPrice: tx.gasPrice.toString(),
                nonce: tx.nonce,
            },
        })

        return tx
    }

    async removeMargin(
        trader: Wallet,
        ammAddr: string,
        marginToBeRemoved: Big,
        overrides?: Overrides,
    ): Promise<TransactionResponse> {
        const clearingHouse = await this.createClearingHouse(trader)
        const tx = await clearingHouse.functions.removeMargin(
            ammAddr,
            { d: PerpService.toWei(marginToBeRemoved) },
            {
                gasLimit: 1_500_000,
                ...overrides,
            },
        )
        this.log.jinfo({
            event: "RemoveMarginTxSent",
            params: {
                trader: trader.address,
                amm: ammAddr,
                marginToBeRemoved: +marginToBeRemoved.toFixed(),
                txHash: tx.hash,
                gasPrice: tx.gasPrice.toString(),
                nonce: tx.nonce,
            },
        })
        return tx
    }

    async addMargin(
        trader: Wallet,
        ammAddr: string,
        marginToBeAdded: Big,
        overrides?: Overrides,
    ): Promise<TransactionResponse> {
        const clearingHouse = await this.createClearingHouse(trader)
        const tx = await clearingHouse.functions.addMargin(
            ammAddr,
            { d: PerpService.toWei(marginToBeAdded) },
            {
                gasLimit: 1_500_000,
                ...overrides,
            },
        )
        this.log.jinfo({
            event: "AddMarginTxSent",
            params: {
                trader: trader.address,
                amm: ammAddr,
                marginToBeRemoved: +marginToBeAdded.toFixed(),
                txHash: tx.hash,
                gasPrice: tx.gasPrice.toString(),
                nonce: tx.nonce,
            },
        })
        return tx
    }

    async getUnrealizedPnl(ammAddr: string, traderAddr: string, pnlCalOption: PnlCalcOption): Promise<Big> {
        const clearingHouseViewer = await this.createClearingHouseViewer()
        const unrealizedPnl = (await clearingHouseViewer.functions.getUnrealizedPnl(ammAddr, traderAddr, BigNumber.from(pnlCalOption)))[0]
        return Big(PerpService.fromWei(unrealizedPnl.d))
    }

    // noinspection JSMethodCanBeStatic
    static fromWei(wei: BigNumber): Big {
        return Big(formatEther(wei))
    }

    // noinspection JSMethodCanBeStatic
    static toWei(val: Big): BigNumber {
        return parseEther(val.toFixed(18))
    }
}

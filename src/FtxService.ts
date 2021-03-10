/* eslint-disable @typescript-eslint/no-explicit-any */
import { Log } from "./Log"
import { Service } from "typedi"
import { Side } from "./PerpService"
import Big from "big.js"
import fetch from "node-fetch"

@Service()
export class FtxService {
    private readonly log = Log.getLogger(FtxService.name)

    async getMarket(marketName: string): Promise<FtxMarket> {
        const response = await fetch(`https://ftx.com/api/markets/${marketName}`)
        const result: any[] = (await response.json()).result
        const ftxMarket = this.toFtxMarket(result)
        return ftxMarket
    }

    async getAccountInfo(ftxClient: any): Promise<AccountInfo> {
        const data = await ftxClient.request({
            method: "GET",
            path: "/account",
        })
        this.log.jinfo({
            event: "GetAccountInfo",
            params: data,
        })

        const positionsMap: Record<string, FtxPosition> = {}
        for (let i = 0; i < data.result.positions.length; i++) {
            const positionEntity = data.result.positions[i]
            const position = this.toFtxPosition(positionEntity)
            positionsMap[position.future] = position
        }

        return {
            freeCollateral: Big(data.result.freeCollateral),
            totalAccountValue: Big(data.result.totalAccountValue),
            // marginFraction is null if the account has no open positions
            marginFraction: Big(data.result.marginFraction ? data.result.marginFraction : 0),
            maintenanceMarginRequirement: Big(data.result.maintenanceMarginRequirement),
            positionsMap: positionsMap,
        }
    }

    async getTotalPnLs(ftxClient: any): Promise<Record<string, number>> {
        const data = await ftxClient.request({
            method: "GET",
            path: "/pnl/historical_changes",
        })
        return data.result.totalPnl
    }

    async placeOrder(ftxClient: any, payload: PlaceOrderPayload): Promise<void> {
        const data = await ftxClient.request({
            method: "POST",
            path: "/orders",
            data: payload,
        })
        this.log.jinfo({
            event: "PlaceOrder",
            params: data,
        })
    }

    static mitigatePositionSizeDiff(perpfiPositionSize: Big, ftxPositionSize: Big): PositionSizeMitigation {
        const ftxSizeDiff = ftxPositionSize.add(perpfiPositionSize)
        let side = null
        if (ftxSizeDiff.gte(Big(0))) {
            // FTX shorts too little or longs too much
            side = Side.SELL
        } else {
            // FTX shorts too much or longs too little
            side = Side.BUY
        }

        return {
            sizeAbs: ftxSizeDiff.abs(),
            side,
        }
    }

    // noinspection JSMethodCanBeStatic
    private toFtxMarket(market: any): FtxMarket {
        return {
            name: market.name,
            last: market.last ? Big(market.last) : undefined,
        }
    }

    private toFtxPosition(positionEntity: any): FtxPosition {
        return {
            future: positionEntity.future,
            netSize: Big(positionEntity.netSize),
            entryPrice: Big(positionEntity.entryPrice ? positionEntity.entryPrice : 0),
            realizedPnl: Big(positionEntity.realizedPnl ? positionEntity.realizedPnl : 0),
            cost: Big(positionEntity.cost ? positionEntity.cost : 0),
        }
    }
}

export interface AccountInfo {
    freeCollateral: Big
    totalAccountValue: Big
    marginFraction: Big
    maintenanceMarginRequirement: Big
    positionsMap: Record<string, FtxPosition>
}

export interface FtxPosition {
    future: string
    netSize: Big // + is long and - is short
    entryPrice: Big
    realizedPnl: Big
    cost: Big
}

export interface PlaceOrderPayload {
    market: string
    side: string
    price: null
    size: number
    type: string
}

export interface PositionSizeMitigation {
    sizeAbs: Big
    side: Side
}

export interface FtxMarket {
    name: string
    last?: Big
}

/* eslint-disable @typescript-eslint/no-explicit-any */
import { Log } from "./Log"
import { Service } from "typedi"
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

    async getBalance(ftxClient: any): Promise<Big> {
        const data = await ftxClient.request({
            method: "GET",
            path: "/wallet/balances",
        })
        this.log.jinfo({
            event: "getBalance",
            params: data,
        })
        for (let i = 0; i < data.result.length; i++) {
            const asset = data.result[i]
            if (asset.coin === "USD") {
                return Big(asset.free)
            }
        }
        return Big(0)
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
        return {
            totalAccountValue: Big(data.result.totalAccountValue),
            // marginFraction is null if the account has no open positions
            marginFraction: Big(data.result.marginFraction ? data.result.marginFraction : 0),
            maintenanceMarginRequirement: Big(data.result.maintenanceMarginRequirement),
        }
    }

    async getTotalPnLs(ftxClient: any): Promise<Record<string, number>> {
        const data = await ftxClient.request({
            method: "GET",
            path: "/pnl/historical_changes",
        })
        return data.result.totalPnl
    }

    async getPositions(ftxClient: any): Promise<Record<string, Position>> {
        const data = await ftxClient.request({
            method: "GET",
            path: "/positions",
        })
        this.log.jinfo({
            event: "GetPositions",
            params: data,
        })
        const positions: Record<string, Position> = {}
        for (let i = 0; i < data.result.length; i++) {
            const positionEntity = data.result[i]
            const position: Position = {
                future: positionEntity.future,
                netSize: Big(positionEntity.netSize),
                entryPrice: Big(positionEntity.entryPrice ? positionEntity.entryPrice : 0),
                realizedPnl: Big(positionEntity.realizedPnl ? positionEntity.realizedPnl : 0),
                cost: Big(positionEntity.cost ? positionEntity.cost : 0),
            }
            positions[position.future] = position
        }
        return positions
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

    // noinspection JSMethodCanBeStatic
    private toFtxMarket(market: any): FtxMarket {
        return {
            name: market.name,
            last: market.last ? Big(market.last) : undefined,
        }
    }
}

export interface AccountInfo {
    totalAccountValue: Big
    marginFraction: Big
    maintenanceMarginRequirement: Big
}

export interface Position {
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

export interface FtxMarket {
    name: string
    last?: Big
}

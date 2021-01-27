import { Log } from "./Log"
import { ServerProfile } from "./ServerProfile"
import { Service } from "typedi"
import { SystemMetadata } from "../scripts/helper"
import fetch from "node-fetch"

@Service()
export class SystemMetadataFactory {
    private readonly log = Log.getLogger(SystemMetadataFactory.name)
    private ethMetadata!: EthMetadata

    constructor(readonly serverProfile: ServerProfile) {}

    async fetch(): Promise<EthMetadata> {
        if (!this.ethMetadata) {
            this.ethMetadata = await this._fetch()
        }
        return this.ethMetadata
    }

    private async _fetch(): Promise<EthMetadata> {
        const systemMetadata = await this.getSystemMetadata()
        return this.toEthMetadata(systemMetadata)
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    private async getSystemMetadata(): Promise<any> {
        return await fetch("https://metadata.perp.exchange/production.json").then(res => res.json())
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    private toEthMetadata(system: SystemMetadata): EthMetadata {
        const contracts = system.layers.layer2!.contracts
        return {
            insuranceFundAddr: contracts.InsuranceFund.address,
            ammReaderAddr: contracts.AmmReader.address,
            clearingHouseAddr: contracts.ClearingHouse.address,
            clearingHouseViewerAddr: contracts.ClearingHouseViewer.address,
        }
    }
}

export interface EthMetadata {
    readonly insuranceFundAddr: string
    readonly ammReaderAddr: string
    readonly clearingHouseAddr: string
    readonly clearingHouseViewerAddr: string
}

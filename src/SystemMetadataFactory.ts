import { Log } from "./Log"
import { ServerProfile } from "./ServerProfile"
import { Service } from "typedi"
import fetch from "node-fetch"

@Service()
export class SystemMetadataFactory {
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

export type Network = "homestead" | "xdai"
export type Layer = "layer1" | "layer2"

export interface ContractMetadata {
    name: string
    address: string
}

export interface AccountMetadata {
    privateKey: string
    balance: string
}

export interface EthereumMetadata {
    contracts: Record<string, ContractMetadata>
    accounts: AccountMetadata[]
    network: Network
}

export interface ExternalContracts {
    // default is gnosis multisig safe which plays the governance role
    foundationGovernance?: string

    // default is gnosis multisig safe which plays the treasury role
    foundationTreasury?: string

    keeper?: string
    arbitrageur?: string

    ambBridgeOnXDai?: string
    ambBridgeOnEth?: string
    multiTokenMediatorOnXDai?: string
    multiTokenMediatorOnEth?: string

    tether?: string
    usdc?: string
    perp?: string

    testnetFaucet?: string
}

export interface LayerMetadata extends EthereumMetadata {
    externalContracts: ExternalContracts
}

export interface SystemMetadata {
    layers: {
        [key in Layer]?: LayerMetadata
    }
}

export interface EthMetadata {
    readonly insuranceFundAddr: string
    readonly ammReaderAddr: string
    readonly clearingHouseAddr: string
    readonly clearingHouseViewerAddr: string
}

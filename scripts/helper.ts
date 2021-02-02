import { ExecOptions } from "child_process"
import { resolve } from "path"
import { exec, test } from "shelljs"

export type Stage = "production"
export type Network = "homestead" | "rinkeby" | "ropsten" | "kovan" | "xdai" | "sokol" | "localhost"
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

export interface LayerMetadata extends EthereumMetadata {
    externalContracts: ExternalContracts
}

export interface SystemMetadata {
    layers: {
        [key in Layer]?: LayerMetadata
    }
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

export function getNpmBin(cwd?: string) {
    const options: { [key: string]: any } = { silent: true }
    if (cwd) {
        options.cwd = cwd
    }

    return exec("npm bin", options)
        .toString()
        .trim()
}

/**
 * Execute command in in local node_modules directory
 * @param commandAndArgs command with arguments
 */
export function asyncExec(commandAndArgs: string, options?: ExecOptions): Promise<string> {
    const [command, ...args] = commandAndArgs.split(" ")
    const cwd = options ? options.cwd : undefined
    const npmBin = resolve(getNpmBin(cwd), command)
    const realCommand = test("-e", npmBin) ? `${npmBin} ${args.join(" ")}` : commandAndArgs
    console.log(`> ${realCommand}`)
    return new Promise<string>((resolve, reject) => {
        const cb = (code: number, stdout: string, stderr: string) => {
            if (code !== 0) {
                reject(stderr)
            } else {
                resolve(stdout)
            }
        }

        if (options) {
            exec(realCommand, options, cb)
        } else {
            exec(realCommand, cb)
        }
    })
}

export function sleep(ms: number): Promise<unknown> {
    return new Promise(resolve => setTimeout(resolve, ms))
}

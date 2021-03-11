/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { Service } from "typedi"
import { Log } from "./Log"

@Service()
export class ServerProfile {
    private readonly log = Log.getLogger(ServerProfile.name)
    readonly web3Endpoint: string
    readonly arbitrageurPK: string
    readonly ftxApiKey: string
    readonly ftxApiSecret: string
    readonly ftxSubaccount: string | undefined

    constructor() {
        this.web3Endpoint = process.env.WEB3_ENDPOINT!
        this.arbitrageurPK = process.env.ARBITRAGEUR_PK!
        this.ftxApiKey = process.env.FTX_API_KEY!
        this.ftxApiSecret = process.env.FTX_API_SECRET!
        this.ftxSubaccount = process.env.FTX_SUBACCOUNT

        this.log.jinfo({
            event: "ServerProfile",
            params: {
                web3Endpoint: this.web3Endpoint,
            }
        })
    }
}

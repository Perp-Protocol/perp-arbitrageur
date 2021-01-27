import "reflect-metadata" // this shim is required
import "source-map-support/register"
import { configure } from "log4js"
import { defaultTo } from "lodash"

export const PROJECT_NAME = "perp-arbitrageur-v2"

// log4ts
configure({
    appenders: {
        out: { type: "stdout" },
    },
    categories: {
        default: { appenders: ["out"], level: "info" },
    },
})

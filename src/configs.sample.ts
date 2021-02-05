import Big from "big.js"

export const preflightCheck = {
    BLOCK_TIMESTAMP_FRESHNESS_THRESHOLD: 60 * 30, // 30 minutes
    XDAI_BALANCE_WARNING_THRESHOLD: Big(1),
    USDC_BALANCE_WARNING_THRESHOLD: Big(100),
    FTX_USD_BALANCE_WARNING_THRESHOLD: Big(100),
    FTX_MARGIN_RATIO_WARNING_THRESHOLD: Big(0.1), // 10%
}

export interface AmmConfig {
    ENABLED: boolean
    ASSET_CAP: Big
    PERPFI_LEVERAGE: Big
    PERPFI_MIN_TRADE_NOTIONAL: Big
    PERPFI_SHORT_ENTRY_TRIGGER: Big
    PERPFI_LONG_ENTRY_TRIGGER: Big
    MAX_SLIPPAGE_RATIO: Big
    FTX_MARKET_ID: string
    FTX_MIN_TRADE_SIZE: Big
}

export const ammConfigMap: Record<string, AmmConfig> = {
    "BTC-USDC": {
        ENABLED: false,
        ASSET_CAP: Big(1000),
        PERPFI_LEVERAGE: Big(5),
        PERPFI_MIN_TRADE_NOTIONAL: Big(10),
        PERPFI_SHORT_ENTRY_TRIGGER: Big(0.5).div(100),
        PERPFI_LONG_ENTRY_TRIGGER: Big(-0.5).div(100),
        MAX_SLIPPAGE_RATIO: Big(0.0001),
        FTX_MARKET_ID: "BTC-PERP",
        FTX_MIN_TRADE_SIZE: Big(0.001),
    },
    "ETH-USDC": {
        ENABLED: false,
        ASSET_CAP: Big(1000),
        PERPFI_LEVERAGE: Big(5),
        PERPFI_MIN_TRADE_NOTIONAL: Big(10),
        PERPFI_SHORT_ENTRY_TRIGGER: Big(0.5).div(100),
        PERPFI_LONG_ENTRY_TRIGGER: Big(-0.5).div(100),
        MAX_SLIPPAGE_RATIO: Big(0.0001),
        FTX_MARKET_ID: "ETH-PERP",
        FTX_MIN_TRADE_SIZE: Big(0.001),
    },
    "YFI-USDC": {
        ENABLED: true,
        ASSET_CAP: Big(1000),
        PERPFI_LEVERAGE: Big(5),
        PERPFI_MIN_TRADE_NOTIONAL: Big(10),
        PERPFI_SHORT_ENTRY_TRIGGER: Big(0.5).div(100),
        PERPFI_LONG_ENTRY_TRIGGER: Big(-0.5).div(100),
        MAX_SLIPPAGE_RATIO: Big(0.0001),
        FTX_MARKET_ID: "YFI-PERP",
        FTX_MIN_TRADE_SIZE: Big(0.001),
    },
    "DOT-USDC": {
        ENABLED: false,
        ASSET_CAP: Big(1000),
        PERPFI_LEVERAGE: Big(5),
        PERPFI_MIN_TRADE_NOTIONAL: Big(10),
        PERPFI_SHORT_ENTRY_TRIGGER: Big(0.5).div(100),
        PERPFI_LONG_ENTRY_TRIGGER: Big(-0.5).div(100),
        MAX_SLIPPAGE_RATIO: Big(0.0001),
        FTX_MARKET_ID: "DOT-PERP",
        FTX_MIN_TRADE_SIZE: Big(0.1),
    },
    "SNX-USDC": {
        ENABLED: true,
        ASSET_CAP: Big(1000),
        PERPFI_LEVERAGE: Big(5),
        PERPFI_MIN_TRADE_NOTIONAL: Big(10),
        PERPFI_SHORT_ENTRY_TRIGGER: Big(0.5).div(100),
        PERPFI_LONG_ENTRY_TRIGGER: Big(-0.5).div(100),
        MAX_SLIPPAGE_RATIO: Big(0.0001),
        FTX_MARKET_ID: "SNX-PERP",
        FTX_MIN_TRADE_SIZE: Big(0.1),
    },
}

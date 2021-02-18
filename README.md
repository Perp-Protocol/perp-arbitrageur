# perp-arbitrageur
This strategy is doing "buy low, sell high" to make profit between two different exchanges. For example, most of the time, the price of ETH-PERP at Perp exchange and FTX will be similar. However, due to the price movement, the difference may be larger. As a result, we could do the arbitrage to open positions when the price difference (spread) is greater than normal, and to close the positions when the spread is back to normal. 

For example, when the ETH-perp at Perp exchange is 1500, and 1520 at FTX. Then, we could long ETH-perp at Perp exchange, and short at FTX. After few moments later, the price at Perp exchange increases to 1550, and the price at FTX increases to 1555, we short at Perp exchange and long at FTX to close the positions at both exchanges. The PnL will be +50 at Perp exchange, -35 at FTX, and total is  +15. 

Note that there are many parameters you can adjust based on your knowledge and own risks such as leverage, trigger conditions, exit condition...etc, and this code is only for tutorial and example.  

## Installation

```bash
$ git clone https://github.com/perpetual-protocol/perp-arbitrageur.git
$ cd perp-arbitrageur
$ npm install
$ cp .env.production.sample .env.production
$ cp src/configs.sample.ts src/configs.ts
```

## Configuration

Provide your private keys in `.env.production`:

```bash
# The private key must start with "0x"
ARBITRAGEUR_PK=YOUR_WALLET_PRIVATE_KEY

FTX_API_KEY=YOUR_FTX_API_KEY
FTX_API_SECRET=YOUR_FTX_API_SECRET
```

Edit the trading parameters in `src/configs.ts`:

```ts
export const preflightCheck = {
    BLOCK_TIMESTAMP_FRESHNESS_THRESHOLD: 60 * 30, // 30 minutes
    XDAI_BALANCE_THRESHOLD: Big(1),
    USDC_BALANCE_THRESHOLD: Big(100),
    FTX_USD_BALANCE_THRESHOLD: Big(100),
    FTX_MARGIN_RATIO_THRESHOLD: Big(0.1), // 10%
}

export const ammConfigMap = {
    "BTC-USDC": {
        ENABLED: true,
        ASSET_CAP: Big(1000),
        PERPFI_LEVERAGE: Big(5),
        PERPFI_MIN_TRADE_NOTIONAL: Big(10),
        PERPFI_SHORT_ENTRY_TRIGGER: Big(0.5).div(100),
        PERPFI_LONG_ENTRY_TRIGGER: Big(-0.5).div(100),
        MAX_SLIPPAGE_RATIO: Big(0.0001),
        FTX_MARKET_ID: "BTC-PERP",
        FTX_MIN_TRADE_SIZE: Big(0.001),
    },
    ...
}
```

Read [src/configs.sample.ts](https://github.com/perpetual-protocol/perp-arbitrageur/blob/main/src/configs.sample.ts) and [src/Arbitrageur.ts](https://github.com/perpetual-protocol/perp-arbitrageur/blob/main/src/Arbitrageur.ts) for more details.

## Deposit

- Deposit enough USDC on [Perpetual Protocol Exchange](https://perp.exchange/)
- Deposit enough USD or Stablecoins on [FTX](https://ftx.com/)

## Run

You can run `perp-arbitrageur` in the following environments:

### Localhost

```bash
$ npm run build
$ npm run arbitrage
```

### AWS Lambda

You might need to install [AWS CLI](https://aws.amazon.com/cli/) first.

```bash
$ aws configure
$ npm run deploy
```

Read [serverless.yml](https://github.com/perpetual-protocol/perp-arbitrageur/blob/main/serverless.yml) for more details.

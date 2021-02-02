# arbitrageur

## Installation

```bash
$ git clone https://github.com/perpetual-protocol/arbitrageur.git
$ cd arbitrageur
$ npm install
```

## Configuration

- Deposit enough USDC to your wallet on [Perpetual Protocol Exchange](https://perp.exchange/)
- Deposit enough USD or Stablecoins to your account on [FTX](https://ftx.com/)
- In `.env.production` file, replace the following variables with yours
    - `ARBITRAGEUR_V2_PK`
    - `FTX_API_KEY`
    - `FTX_API_SECRET`
- In `src/Arbitrageur.ts`, adjust the following variables according to your funds
    - `XDAI_BALANCE_WARNING_THRESHOLD`
    - `QUOTE_BALANCE_REFILL_THRESHOLD`
    - `PERP_LEVERAGE`
    - `FTX_USD_BALANCE_WARNING_THRESHOLD`
    - `subaccount` if you're using a subaccount for FTX

See [src/Arbitrageur.ts](https://github.com/perpetual-protocol/arbitrageur/blob/main/src/Arbitrageur.ts) for more details.

## Run

You could simply run this bot in your terminal:

```bash
$ npm run build
$ npm run arbitrage
```

Also, you could deploy this bot on AWS Lambda:

```bash
# You might need to install AWS CLI from https://aws.amazon.com/cli/
$ aws configure

$ npm run deploy
```

See [serverless.yml](https://github.com/perpetual-protocol/arbitrageur/blob/main/serverless.yml) for more details.

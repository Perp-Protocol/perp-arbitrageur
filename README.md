# perp-arbitrageur

## Installation

```bash
$ git clone https://github.com/perpetual-protocol/perp-arbitrageur.git
$ cd perp-arbitrageur
$ npm install
$ cp .env.production.sample .env.production
```

## Configuration

- Deposit enough USDC to your wallet on [Perpetual Protocol Exchange](https://perp.exchange/)
- Deposit enough USD or Stablecoins to your account on [FTX](https://ftx.com/)
- In `.env.production` file, replace the following variables:
    - `ARBITRAGEUR_PK` make sure your private key has `0x` prefix
    - `FTX_API_KEY`
    - `FTX_API_SECRET`
- In `src/Arbitrageur.ts`, adjust the following settings:
    - `XDAI_BALANCE_WARNING_THRESHOLD`
    - `QUOTE_BALANCE_REFILL_THRESHOLD`
    - `FTX_USD_BALANCE_WARNING_THRESHOLD`
    - `PERP_LEVERAGE`
    - `ENABLED`
    - `subaccount` if you're using a subaccount for FTX

See [src/Arbitrageur.ts](https://github.com/perpetual-protocol/perp-arbitrageur/blob/main/src/Arbitrageur.ts) for more details.

## Run

Currently, you can run `perp-arbitrageur` in following environments:

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

See [serverless.yml](https://github.com/perpetual-protocol/perp-arbitrageur/blob/main/serverless.yml) for more details.

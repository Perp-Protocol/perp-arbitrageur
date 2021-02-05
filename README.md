# perp-arbitrageur

## Installation

```bash
$ git clone https://github.com/perpetual-protocol/perp-arbitrageur.git
$ cd perp-arbitrageur
$ npm install
$ cp .env.production.sample .env.production
$ cp src/configs.sample.ts src/configs.ts
```

## Configuration

- Deposit enough USDC to your wallet on [Perpetual Protocol Exchange](https://perp.exchange/)
- Deposit enough USD or Stablecoins to your account on [FTX](https://ftx.com/)
- Edit the following configuration files:
    - `.env.production`
    - `src/configs.ts`

Read [src/configs.sample.ts](https://github.com/perpetual-protocol/perp-arbitrageur/blob/main/src/configs.sample.ts) and [src/Arbitrageur.ts](https://github.com/perpetual-protocol/perp-arbitrageur/blob/main/src/Arbitrageur.ts) for more details.

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

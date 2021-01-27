# arbitrageur

## Installation

```bash
$ git clone https://github.com/perpetual-protocol/arbitrageur.git
$ cd arbitrageur
$ npm install
```

## Configuration

- Deposit enough USDC on [Perpetual Protocol Exchange](https://perp.exchange/)
- Deposit enough USD or Stablecoins in your FTX account
- Replace the following variables with yours in `.env.production` file
    - `ARBITRAGEUR_V2_PK`
    - `FTX_API_KEY`
    - `FTX_API_SECRET`

## Run

```bash
$ env $(cat .env.production | grep -v '#' | xargs) npm run arbitrage
```

See [Arbitrageur.ts](https://github.com/perpetual-protocol/arbitrageur/blob/main/src/Arbitrageur.ts) for more details.
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

See [Arbitrageur.ts](https://github.com/perpetual-protocol/arbitrageur/blob/main/src/Arbitrageur.ts) for more details.

## Run

```bash
$ env $(cat .env.production | grep -v '#' | xargs) npm run arbitrage
```

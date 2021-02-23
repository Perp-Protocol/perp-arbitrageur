# perp-arbitrageur
This strategy is doing "buy low, sell high" to make profit between two different exchanges. For example, most of the time, the price of ETH-PERP at Perp exchange and FTX will be similar. However, due to the price movement, the difference may be larger. As a result, we could do the arbitrage to open positions when the price difference (spread) is greater than normal level, and to close the positions when the spread is back to normal level. 

For example, when the ETH-perp at Perp exchange is 1500, and 1520 at FTX. Then, we could long ETH-perp at Perp exchange, and short at FTX. A few moment later, the price at Perp exchange increases to 1550, and the price at FTX increases to 1555, we short ETH-perp at Perp exchange and long it at FTX to close the positions at both exchanges. The PnL will be +50 at Perp exchange, -35 at FTX, and total is  +15. 

By adjusting the long & short enter trigger of the spread, you may easily do the arbitrage! Please review the definition of each parameters in the code carefully. Note that there are many parameters you can adjust based on your knowledge and own risk such as leverage, trigger conditions, exit condition...etc, and this code is only for tutorial and example. 

Disclaimer
YOU (MEANING ANY INDIVIDUAL OR ENTITY ACCESSING, USING OR BOTH THE SOFTWARE INCLUDED IN THIS GITHUB REPOSITORY) EXPRESSLY UNDERSTAND AND AGREE THAT YOUR USE OF THE SOFTWARE IS AT YOUR SOLE RISK. THE SOFTWARE IN THIS GITHUB REPOSITORY IS PROVIDED “AS IS”, WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE. YOU RELEASE AUTHORS OR COPYRIGHT HOLDERS FROM ALL LIABILITY FOR YOU HAVING ACQUIRED OR NOT ACQUIRED CONTENT IN THIS GITHUB REPOSITORY. THE AUTHORS OR COPYRIGHT HOLDERS MAKE NO REPRESENTATIONS CONCERNING ANY CONTENT CONTAINED IN OR ACCESSED THROUGH THE SERVICE, AND THE AUTHORS OR COPYRIGHT HOLDERS WILL NOT BE RESPONSIBLE OR LIABLE FOR THE ACCURACY, COPYRIGHT COMPLIANCE, LEGALITY OR DECENCY OF MATERIAL CONTAINED IN OR ACCESSED THROUGH THIS GITHUB REPOSITORY.

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
    FTX_MARGIN_RATIO_THRESHOLD: Big(0.1), 
}

export const ammConfigMap = {
    "BTC-USDC": {
        ENABLED: true, // "true to enable it, "false" to disable it
        ASSET_CAP: Big(1000), // You may adjust it based on your own risk.
        PERPFI_LEVERAGE: Big(2), // You may adjust it based on your own risk.
        PERPFI_MIN_TRADE_NOTIONAL: Big(10), 
        PERPFI_SHORT_ENTRY_TRIGGER: Big(0.5).div(100), // open the short position at Perp exchange when the spread is >= 0.5 % 
        PERPFI_LONG_ENTRY_TRIGGER: Big(-0.5).div(100), // open the long position at Perp excahnge when the spread is =< -0.5%
        MAX_SLIPPAGE_RATIO: Big(0.001), // set the max slippage ratio limit to avoid large slippage 
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

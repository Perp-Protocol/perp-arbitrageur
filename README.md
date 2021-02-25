# perp-arbitrageur
The `perp-arbitrageur` is an arbitrage bot that can be run on AWS Lambda (works with free tier) or locally. The bot allows you to execute automated trading strategies between Perpetual Protocol ([site](https://perp.fi/), [docs](https://docs.perp.fi/)) and FTX ([site](https://ftx.com/)).

Since Perpetual Protocol runs on xDai, you can use this bot entirely without paying gas fees on Ethereum. Gas fees on xDai are very low (1 Gwei).

Comments or questions? Come to the #⛏coding-chat channel on our Discord: https://discord.gg/mYKKRTn

Want to report bugs or submit updates? Issues and PRs are welcome!

# Default Strategy
The default strategy is to "buy low, sell high" to make profit between two different exchanges. For example, most of the time, the price of ETH-PERP at Perpetual Protocol and FTX will be similar. However, price action on the exchanges leads to price differentials from time to time. This bot is designed to open positions when the price difference (spread) is greater than a set level, and to close the positions when the spread decreases below a set level. 

For example, when the ETH-perp on Perpetual Protocol is 1500, and 1520 at FTX, we could long ETH-perp at Perp exchange, and short at FTX in the expectation that some time later the prices will converge. Let's say the price at Perpetual Protocol increases to 1550, and the price at FTX increases to 1555. The bot will sell the positions at both exchanges. The PnL in this example will be +50 USD on Perpetual Protocol, and -35 USD at FTX, for a total of +15 USD. 

After some setup, by adjusting `PERPFI_SHORT_ENTRY_TRIGGER` and `PERPFI_LONG_ENTRY_TRIGGER`, you can easily do arbitrage between Perptual Protocol and FTX. Please review the definitions of each parameter in the code carefully. Note that there are many parameters you can adjust based on your knowledge and own risk such as leverage, trigger conditions, exit conditions, etc. 
# Note
This code is provided only for educational purposes only. Derivatives trading carries substantial risks and possible loss of up to 100% of your funds. Perpetual contract trading may be regulated in your jurisdiction. Be sure to check local laws before trading.


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
# The private key must start with "0x" - add it if necessary (e.g. from private key exported from Metamask)
ARBITRAGEUR_PK=YOUR_WALLET_PRIVATE_KEY

# FTX API keys
# These can be obtained by going to FTX Settings > API Keys > "Create API key for bot"
FTX_API_KEY=YOUR_FTX_API_KEY
FTX_API_SECRET=YOUR_FTX_API_SECRET
```
**Note** the node endpoint defined in `.env.production` must point to an xDai node. By default, xDai's [official endpoint](https://www.xdaichain.com/for-developers/developer-resources#json-rpc-endpoints) is used. You can also choose to use [Quiknode](https://www.quiknode.io/), or spin up [your own node](https://www.xdaichain.com/for-validators/node-deployment/manual-deployment). Ethereum nodes such as **Infura or Alchemy will not work**.

Edit the trading parameters in `src/configs.ts`:

```ts
export const preflightCheck = {
    BLOCK_TIMESTAMP_FRESHNESS_THRESHOLD: 60 * 30, // default 30 minutes
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

- Deposit xUSDC for trading on [Perpetual Protocol Exchange](https://perp.exchange/) - xUSDC can be deposited into your wallet either via perp.exchange, or using the xDai [Omni Bridge](https://omni.xdaichain.com/). xUSDC is the USDC token that has been transfered to xDai.
- Deposit [xDAI](https://www.xdaichain.com/for-users/get-xdai-tokens) in your wallet to pay for gas on xDai (note xDai gas fees are typically 1 Gwei and paid in xDAI, DAI tokens that have been transfered to xDai.)
- Deposit enough USD or appropriate stablecoins on [FTX](https://ftx.com/)

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

### Disclaimer

YOU (MEANING ANY INDIVIDUAL OR ENTITY ACCESSING, USING OR BOTH THE SOFTWARE INCLUDED IN THIS GITHUB REPOSITORY) EXPRESSLY UNDERSTAND AND AGREE THAT YOUR USE OF THE SOFTWARE IS AT YOUR SOLE RISK. THE SOFTWARE IN THIS GITHUB REPOSITORY IS PROVIDED “AS IS”, WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE. YOU RELEASE AUTHORS OR COPYRIGHT HOLDERS FROM ALL LIABILITY FOR YOU HAVING ACQUIRED OR NOT ACQUIRED CONTENT IN THIS GITHUB REPOSITORY. THE AUTHORS OR COPYRIGHT HOLDERS MAKE NO REPRESENTATIONS CONCERNING ANY CONTENT CONTAINED IN OR ACCESSED THROUGH THE SERVICE, AND THE AUTHORS OR COPYRIGHT HOLDERS WILL NOT BE RESPONSIBLE OR LIABLE FOR THE ACCURACY, COPYRIGHT COMPLIANCE, LEGALITY OR DECENCY OF MATERIAL CONTAINED IN OR ACCESSED THROUGH THIS GITHUB REPOSITORY.

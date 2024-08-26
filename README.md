1. Install dependencies using `npm install`
2. Set the environment variables via command line or a .env file in this directory.
   - `STAGE` should be set to either `testnet` or `mainnet`
   - `RPC_URL` is the RPC URL for the given chain
   - `PRIVATE_KEY` must be the wallet private key which owns the Chainlink Functions subscription
   - `OPENAI_API_KEY` is an API key for ChatGPT 4o
   - `API_KEY` is an API key authorized to send requests to get offer data for Chainlink Functions from our backend (these are comma-separated keys set for the `INTERNAL_API_KEYS` environment variable in our backend)
   - `GITHUB_TOKEN` which is a Github token with permission to upload Gists ([see here](https://github.com/smartcontractkit/functions-hardhat-starter-kit?tab=readme-ov-file#using-remote-secrets-eg-github-gists))
   - `TWITTER_API_BEARER_TOKEN_2` is a valid Twitter API token. For mainnet, this should be a completely separate token which is different from the one used in the backend. This mitigates risk of hitting API rate limits which cause verification errors in the contract.
3. run `ts-node ./uploadScriptGistsAndGenerateOffchainSects.ts` (must have [ts-node](https://www.npmjs.com/package/ts-node) installed)
4. Copy `encryptedSecretsReference` into the `deploymentArguments` and replace it with the older one in the contract repo https://github.com/tunnl-io/Tunnl-Contracts/blob/main/deploymentArguments.ts

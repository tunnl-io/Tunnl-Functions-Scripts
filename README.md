1. Install dependencies using `npm install`
2. Set up the env variables in a separate file at `.env`.
   - Repeat the above for all these env variables: `RPC_URL`, `PRIVATE_KEY`, `SCANNER_API_KEY`, `TWITTER_API_BEARER_TOKEN_2`, `OPENAI_API_KEY`, `GITHUB_TOKEN`, `API_KEY`
   - Note that `TWITTER_API_BEARER_TOKEN_2` is a valid Twitter API token, but for mainnet, this is a complete separate token which is different from the one used in the backend. This mitigates risk of hitting API rate limits which cause verification errors in the contract.
3. run `ts-node ./uploadScriptGistsAndGenerateOffchainSects.ts` (must have [ts-node](https://www.npmjs.com/package/ts-node) installed)
4. Copy `encryptedSecretsReference` into the `deploymentArguments` and replace it with the older one in the contract repo https://github.com/tunnl-io/Tunnl-Contracts/blob/main/deploymentArguments.ts

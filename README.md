## Setting up the project locally

1. Install dependencies usinf `npm install`
2. Set up the env variables in a separate file at `.env`.
   - Repeat the above for all these env variables: `RPC_URL`, `PRIVATE_KEY`, `SCANNER_API_KEY`, `TWITTER_API_BEARER_TOKEN`, `OPENAI_API_KEY`, `GITHUB_TOKEN`, `API_KEY`
3. run `ts-node ./uploadScriptGistsAndGenerateOffchainSects.ts`
4. Copy `encryptedSecretsReference` into the `deploymentArguments` and replace it with the older one in the contract repo https://github.com/tunnl-io/Tunnl-Contracts/blob/main/deploymentArguments.ts

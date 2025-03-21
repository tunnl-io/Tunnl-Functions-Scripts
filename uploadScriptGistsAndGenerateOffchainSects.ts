import { SecretsManager, createGist } from "@chainlink/functions-toolkit";
import { LedgerSigner } from "@ethersproject/hardware-wallets";
import { readFileSync } from "fs";
// Note, you need to switch to the ethers v5.7.2 to run this script.
import { ethers } from "ethers";
import { config as envEncConfig } from '@chainlink/env-enc'
require('dotenv').config();

const isMainnet = process.env.STAGE === 'mainnet'

console.log(isMainnet ? 'Mainnet' : 'Testnet')

if (process.env.USE_ENV_ENC?.toLowerCase() === 'true') {
  envEncConfig({
    path: isMainnet ? '/Volumes/TUNNL/encryptedEnvVars/.env.enc.mainnet' : '/Volumes/TUNNL/encryptedEnvVars/.env.enc.testnet'
  });
}

const sha256 = async (text: string) => {
  return Array.from(
    new Uint8Array(
      await crypto.subtle.digest(
        "SHA-256",
        new TextEncoder().encode(text)
      )
    )).map(
      (b)=>b.toString(16).padStart(2,"0")
    ).join("")
}

(async () => {
  const provider = new ethers.providers.JsonRpcProvider(process.env.RPC_URL);
  const signer = new LedgerSigner(provider, 'hid')

  // Upload scripts to Gists & generate hashes
  const verifyScriptString = readFileSync('./src/verifyTweet.js', 'utf8')
  const verifyScriptHash = await sha256(verifyScriptString)
  console.log('\nverifyTweet script hash to set in contract config:', verifyScriptHash)
  const verifyScriptGistUrl = await createGist(process.env.GITHUB_TOKEN!, verifyScriptString)
  const payScriptString = readFileSync('./src/calculatePayment.js', 'utf8')
  const payScriptHash = await sha256(payScriptString)
  console.log('\ncalculatePayment script hash to set in contract config:', payScriptHash)
  const payScriptGistUrl = await createGist(process.env.GITHUB_TOKEN!, payScriptString) 

  let functionsRouterAddress: string
  let donId: string
  let backendUrl: string
  if (isMainnet) {
    functionsRouterAddress = '0xf9b8fc078197181c841c296c876945aaa425b278'
    donId = 'fun-base-mainnet-1'
    backendUrl = 'https://api-tunnl-mainnet-6l3nt.ondigitalocean.app/internal'
  } else {
    functionsRouterAddress = '0xf9B8fc078197181C841c296C876945aaa425B278'
    donId = 'fun-base-sepolia-1'
    backendUrl = 'https://seashell-app-npeyj.ondigitalocean.app/internal'
  }

  const secretsManager = new SecretsManager({
    signer,
    functionsRouterAddress,
    donId,
  })
  await secretsManager.initialize()

  const secrets = {
    backendUrl,
    // twitterKey: process.env.TWITTER_API_BEARER_TOKEN_2!,
    // openAiKey: process.env.OPENAI_API_KEY!,
    apiKey: process.env.API_KEY!,
    verifyScriptUrl: verifyScriptGistUrl,
    payScriptUrl: payScriptGistUrl,
  }
  console.log('\nSecrets to encrypt:', secrets)
  console.log('\nWaiting for Ledger signature...')
  const encryptedSecrets = await secretsManager.encryptSecrets(secrets)
  const gistUrl = await createGist(process.env.GITHUB_TOKEN!, JSON.stringify(encryptedSecrets))
  console.log('\nEncrypted secrets:', gistUrl)
  const encryptedSecretsReference = await secretsManager.encryptSecretsUrls([gistUrl])
  console.log('Encrypted secrets reference to set in contract config:', encryptedSecretsReference)
})()
import { SecretsManager, createGist } from "@chainlink/functions-toolkit";
import { readFileSync } from "fs";
// Note, you need to switch to the ethers v5.7.2 to run this script.
import { ethers } from "ethers";
import { config as envEncConfig } from '@chainlink/env-enc'
envEncConfig({
  path: '/Volumes/TUNNL/encryptedEnvVars/.env.enc.mainnet'
});

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
  const signer = new ethers.Wallet(process.env.PRIVATE_KEY!, provider);

  // Upload scripts to Gists & generate hashes
  const verifyScriptString = readFileSync('./src/verifyTweet.js', 'utf8')
  const verifyScriptHash = await sha256(verifyScriptString)
  console.log('\nverifyTweet script hash to set in contract config:', verifyScriptHash)
  const verifyScriptGistUrl = await createGist(process.env.GITHUB_TOKEN!, verifyScriptString)
  console.log('verifyTweet script uploaded to:', verifyScriptGistUrl)
  const payScriptString = readFileSync('./src/calculatePayment.js', 'utf8')
  const payScriptHash = await sha256(payScriptString)
  console.log('\ncalculatePayment script hash to set in contract config:', payScriptHash)
  const payScriptGistUrl = await createGist(process.env.GITHUB_TOKEN!, payScriptString)
  console.log('calculatePayment script uploaded to:', payScriptGistUrl)

  let functionsRouterAddress: string
  let donId: string

  if (process.env.STAGE === 'mainnet') {
    functionsRouterAddress = '0xf9b8fc078197181c841c296c876945aaa425b278'
    donId = 'fun-base-mainnet-1'
  } else {
    functionsRouterAddress = '0xC17094E3A1348E5C7544D4fF8A36c28f2C6AAE28'
    donId = 'fun-optimism-sepolia-1'
  }

  const secretsManager = new SecretsManager({
    signer,
    functionsRouterAddress,
    donId,
  })
  await secretsManager.initialize()

  const secrets = {
    backendUrl: process.env.BACKEND_URL!,
    twitterKey: process.env.TWITTER_API_BEARER_TOKEN!,
    openAiKey: process.env.OPENAI_API_KEY!,
    apiKey: process.env.API_KEY!,
    verifyScriptUrl: verifyScriptGistUrl,
    payScriptUrl: payScriptGistUrl,
  }
  console.log('\nSecrets to encrypt:', secrets)
  const encryptedSecrets = await secretsManager.encryptSecrets(secrets)
  const gistUrl = await createGist(process.env.GITHUB_TOKEN!, JSON.stringify(encryptedSecrets))
  console.log('\nEncrypted secrets:', gistUrl)
  const encryptedSecretsReference = await secretsManager.encryptSecretsUrls([gistUrl])
  console.log('Encrypted secrets reference to set in contract config:', encryptedSecretsReference)
})()
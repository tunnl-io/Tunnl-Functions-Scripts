import { simulateScript } from '@chainlink/functions-toolkit'
import { readFileSync } from 'fs'

import { config as envEncConfig } from '@chainlink/env-enc'
envEncConfig({
  path: process.env.stage === 'mainnet'
  ? '/Volumes/TUNNL/encryptedEnvVars/.env.enc.mainnet'
  : '/Volumes/TUNNL/encryptedEnvVars/.env.enc.testnet'
});

describe('verifyTweet', () => {
  it('should return a valid tweet', async () => {
    const creationDateSeconds = 1
    const totalOfferValue = 100*10^6
    const offerDuration = 1
    
    const offerId = "34e98beb3677627b6583bcaeadea1bcc65b02ca1b7ca63c9ce7c4a3aee5e1d2f"

    const result = await simulateScript({
      source: readFileSync('./src/fetchVerifyScript.js', 'utf8'),
      args: [
        offerId,
        creationDateSeconds.toString(16),
        totalOfferValue.toString(16),
        offerDuration.toString(16),
      ],
      secrets: {
        verifyScriptUrl: process.env.VERIFY_SCRIPT_URL!,
        twitterKey: process.env.TWITTER_API_BEARER_TOKEN!,
        openAiKey: process.env.OPENAI_API_KEY!,
        apiKey: process.env.API_KEY!,
      },
    })
    console.log(result.errorString)
    console.log(result.capturedTerminalOutput)
    console.log(result.responseBytesHexstring)
    expect(result.responseBytesHexstring).toBeTruthy()
    expect(BigInt(result.responseBytesHexstring!).toString()).toBe(BigInt(1).toString())
  })
})
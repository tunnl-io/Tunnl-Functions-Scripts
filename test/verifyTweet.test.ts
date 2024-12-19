import { simulateScript } from '@chainlink/functions-toolkit'
import { readFileSync } from 'fs'
import { config as envEncConfig } from '@chainlink/env-enc'
require('dotenv').config();

const isMainnet = process.env.STAGE === 'mainnet'

console.log(isMainnet ? 'Mainnet' : 'Testnet')

if (process.env.USE_ENV_ENC?.toLowerCase() === 'true') {
  envEncConfig({
    path: isMainnet ? '/Volumes/TUNNL/encryptedEnvVars/.env.enc.mainnet' : '/Volumes/TUNNL/encryptedEnvVars/.env.enc.testnet'
  });
}

describe('verifyTweet', () => {
  it('should return a valid tweet', async () => {
    const creationDateSeconds = 1
    const totalOfferValue = 100*10^6
    const offerDuration = 1
    
    const offerId = "efecf909612eb13fd3de53b3230df3fb17ec119fefd4cb0998470857065b0780"

    const result = await simulateScript({
      source: readFileSync('./src/verifyTweet.js', 'utf8'),
      bytesArgs: [
        `0x${offerId}`,
        `0x${creationDateSeconds.toString(16)}`,
        `0x${totalOfferValue.toString(16)}`,
        `0x${offerDuration.toString(16)}`,
      ],
      secrets: {
        backendUrl: process.env.BACKEND_URL!,
        verifyScriptUrl: process.env.VERIFY_SCRIPT_URL!,
        twitterKey: process.env.TWITTER_API_BEARER_TOKEN_2!,
        openAiKey: process.env.OPENAI_API_KEY!,
        apiKey: process.env.API_KEY!,
      },
      maxQueryRequestBytes: 1000000,
    })
    if (result.capturedTerminalOutput) {
      console.log(result.capturedTerminalOutput)
    }
    if (result.errorString) {
      console.log(result.errorString)
    }
    if (result.responseBytesHexstring) {
      console.log(result.responseBytesHexstring)
    }
    expect(result.responseBytesHexstring).toBeTruthy()
    expect(BigInt(result.responseBytesHexstring!).toString()).toBe(BigInt(1).toString())
  })
})
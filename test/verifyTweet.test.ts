import { simulateScript } from '@chainlink/functions-toolkit'
import { readFileSync } from 'fs'
import { encryptData, generateEncryptionKey, sha256 } from './util'

import { config as envEncConfig } from '@chainlink/env-enc'
envEncConfig({
  path: process.env.stage === 'mainnet'
  ? '/Volumes/TUNNL/encryptedEnvVars/.env.enc.mainnet'
  : '/Volumes/TUNNL/encryptedEnvVars/.env.enc.testnet'
});

describe('verifyTweet', () => {
  it('should return a valid tweet', async () => {
    const tweetId = '1779228655102689593'
    const creationDateSeconds = 1
    const totalOfferValue = 100*10^6
    
    const key = process.env.KEY_STRING!
    //const offerId = await sha256(JSON.stringify(privateOfferData))
    const offerId = "78fe27641fb36d00fa86a2a60c0cc13c71a8eaef9570d348d265368d26d815bf"

    const result = await simulateScript({
      source: readFileSync('./src/verifyTweet.js', 'utf8'),
      args: [
        offerId,
        encryptData(tweetId, key),
        creationDateSeconds.toString(16),
        totalOfferValue.toString(16),
      ],
      secrets: {
        twitterKey: process.env.TWITTER_API_BEARER_TOKEN!,
        openAiKey: process.env.OPENAI_API_KEY!,
        key,
      },
    })
    console.log(result.errorString)
    console.log(result.capturedTerminalOutput)
    expect(result.responseBytesHexstring).toBeTruthy()
    expect(BigInt(result.responseBytesHexstring!).toString()).toBe(BigInt(1).toString())
  })
})
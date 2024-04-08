import { simulateScript } from '@chainlink/functions-toolkit'
import { readFileSync } from 'fs'
import { encryptData, generateEncryptionKey, sha256 } from './util'

describe('verifyTweet', () => {
  it('should return a valid tweet', async () => {
    const tweetId = '2775352253227909340'
    const creationDateSeconds = 1
    const totalOfferValue = 100*10^6
    
    const key = process.env.ENCRYPTION_KEY!
    //const offerId = await sha256(JSON.stringify(privateOfferData))
    const offerId = "0d77bd85516ffdd20c76c6092aa433801dda153c83d0282bdd63884131d8a2c8"

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
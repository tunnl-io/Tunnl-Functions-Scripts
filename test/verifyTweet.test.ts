import { simulateScript } from '@chainlink/functions-toolkit'
import { readFileSync } from 'fs'
import { encryptData, generateEncryptionKey, sha256 } from './util'

describe('verifyTweet', () => {
  it('should return a valid tweet', async () => {
    const tweetId = '1747817467391402362'
    const privateOfferData = {
      createdAt: new Date(1),
      creator_twitter_id: '1644137470898962433',
      required_likes: '1',
      sponsorship_criteria: 'The tweet must talk about the Chainlink Functions Playground and promote it to javascript developers.',
    }
    const offerId = await sha256(JSON.stringify(privateOfferData))

    const key = generateEncryptionKey()
    const creationDateSeconds = 1
    const totalOfferValue = 100*10^6

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
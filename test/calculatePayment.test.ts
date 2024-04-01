import { simulateScript } from '@chainlink/functions-toolkit'
import { readFileSync } from 'fs'
import { encryptData, generateEncryptionKey, sha256 } from './util'

describe('calculatePayment', () => {
  it('should return a valid tweet', async () => {
    const tweetId = '1464720064729526277'
    const creationDateSeconds = 1
    const totalOfferValue = 100*10^6
    const privateOfferData = {
      createdAt: '1970-01-01T00:00:00.001Z',
      creator_twitter_id: '1234567890',
      required_likes: '1',
      sponsorship_criteria: 'must be a good tweet',
    }
    
    const key = generateEncryptionKey()
    const offerId = await sha256(JSON.stringify(privateOfferData))

    const result = await simulateScript({
      source: readFileSync('./src/calculatePayment.js', 'utf8'),
      args: [
        offerId,
        encryptData(tweetId, key),
        creationDateSeconds.toString(16),
        totalOfferValue.toString(16),
      ],
      secrets: {
        twitterKey: process.env.TWITTER_API_BEARER_TOKEN!,
        key,
      },
    })
    console.log(result.errorString)
    console.log(result.capturedTerminalOutput)
    expect(result.responseBytesHexstring).toBeTruthy()
    expect(BigInt(result.responseBytesHexstring!).toString()).toBe(BigInt(totalOfferValue).toString())
  })
})
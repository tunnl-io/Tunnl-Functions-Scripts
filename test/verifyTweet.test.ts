import { simulateScript } from '@chainlink/functions-toolkit'
import { readFileSync } from 'fs'

describe('verifyTweet', () => {
  it('should return a valid tweet', async () => {
    const creationDateSeconds = 1
    const totalOfferValue = 100*10^6
    const offerDuration = 1
    
    const offerId = "e0a8706eef902babcb5bb1f03daf585013614f08e558f8b956c7117f69731070"

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
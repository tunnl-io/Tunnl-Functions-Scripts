import { simulateScript } from '@chainlink/functions-toolkit'
import { readFileSync } from 'fs'

describe('verifyTweet', () => {
  it('should return a valid tweet', async () => {
    const creationDateSeconds = 1
    const totalOfferValue = 100*10^6
    const offerDuration = 1
    
    const offerId = "8d5aafbd73a5473e017f309f7bad1efd8d88400dc5d3360e1a2e75d879555c3d"

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
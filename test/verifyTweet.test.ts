import { simulateScript } from '@chainlink/functions-toolkit'
import { readFileSync } from 'fs'

describe('verifyTweet', () => {
  it('should return a valid tweet', async () => {
    const creationDateSeconds = 1
    const totalOfferValue = 100*10^6
    const offerDuration = 1
    
    //const offerId = "489d2c3a8bf587b30501d298f6b22f39e0de52f14906f3cb296cec3a3a704d31" // Splin (latest from Kyle)
    //const offerId = "1c7993f73d862e43ecb2184939a9ba9d593deba048262171c2d566c447507e92" // Genuine (task: Draft verified but tweet failed despite exact match)
    //const offerId = "39fd45c4268b8ff140de8178c217f0b7941949cfbd99a60619dea9a1de2268da" // (task: Another draft verified but tweet failed despite match)
    //const offerId = "365754c054cfa3deba882ba6304b6bdf98f3e639f3149ab1c29592220ab238a2" // (task: Another drafter verified but tweet failed)

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
      // 1mb request size
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
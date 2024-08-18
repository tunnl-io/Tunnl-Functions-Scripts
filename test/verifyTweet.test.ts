import { simulateScript } from '@chainlink/functions-toolkit'
import { readFileSync } from 'fs'

describe('verifyTweet', () => {
  it('should return a valid tweet', async () => {
    const creationDateSeconds = 1
    const totalOfferValue = 100*10^6
    const offerDuration = 1
    
    const offerId = "2fa86300caaaf3fba7cba3f6aca4d74ac62652b09261ac7cb126cfe55d273852" //"aaee17783f30f0cea00845f0b92f695e08ab5a42023496bf359a6d963ba271fa"// Acces misspelling "0abe76cb25c730486f8079cf629d8f9ae38857a2b78e9762d19c117b94ea8ca5"

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
      maxQueryRequestBytes: 10000,
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
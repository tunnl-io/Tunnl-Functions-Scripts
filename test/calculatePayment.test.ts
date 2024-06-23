import { simulateScript } from '@chainlink/functions-toolkit'
import { readFileSync } from 'fs'

import { config as envEncConfig } from '@chainlink/env-enc'
envEncConfig({
  path: process.env.stage === 'mainnet'
  ? '/Volumes/TUNNL/encryptedEnvVars/.env.enc.mainnet'
  : '/Volumes/TUNNL/encryptedEnvVars/.env.enc.testnet'
});

describe('calculatePayment', () => {
  it('should return a valid tweet', async () => {
    const creationDateSeconds = 1
    const totalOfferValue = 100*10^6
    const offerDuration = 1
    
    const offerId = "18405027ea7df2505bec0e069dd57e3b07c51ce1b851515e5fe8cd29a828829e"

    const result = await simulateScript({
      source: readFileSync('./src/fetchPaymentScript.js', 'utf8'),
      args: [
        offerId,
        creationDateSeconds.toString(16),
        totalOfferValue.toString(16),
        offerDuration.toString(16),
      ],
      secrets: {
        payScriptUrl: process.env.PAY_SCRIPT_URL!,
        twitterKey: process.env.TWITTER_API_BEARER_TOKEN!,
        apiKey: process.env.API_KEY!,
      },
    })
    console.log(result.errorString)
    console.log(result.capturedTerminalOutput)
    console.log(result.responseBytesHexstring)
    expect(result.responseBytesHexstring).toBeTruthy()
    expect(BigInt(result.responseBytesHexstring!).toString()).toBe(BigInt(totalOfferValue).toString())
  }, 12000)
})
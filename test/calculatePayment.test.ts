import { simulateScript } from '@chainlink/functions-toolkit'
import { readFileSync } from 'fs'
import { encryptData } from './util'

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
    
    const key = process.env.KEY_STRING!
    //const offerId = await sha256(JSON.stringify(privateOfferData))
    const offerId = "da4e7c830d6d5e6cbddff9d36a9a7393a4b9f0947d4714ab3d1385c90a8924ff"

    const result = await simulateScript({
      source: readFileSync('./src/calculatePayment.js', 'utf8'),
      args: [
        offerId,
        creationDateSeconds.toString(16),
        totalOfferValue.toString(16),
        offerDuration.toString(16),
      ],
      secrets: {
        twitterKey: process.env.TWITTER_API_BEARER_TOKEN!,
        key,
      },
    })
    console.log(result.errorString)
    console.log(result.capturedTerminalOutput)
    console.log(result.responseBytesHexstring)
    expect(result.responseBytesHexstring).toBeTruthy()
    expect(BigInt(result.responseBytesHexstring!).toString()).toBe(BigInt(totalOfferValue).toString())
  }, 12000)
})
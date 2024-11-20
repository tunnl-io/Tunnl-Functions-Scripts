const { config: envEncConfig } = require('@chainlink/env-enc')

const isMainnet = process.env.STAGE === 'mainnet'

envEncConfig({
  path: isMainnet ? '/Volumes/TUNNL/encryptedEnvVars/.env.enc.mainnet' : '/Volumes/TUNNL/encryptedEnvVars/.env.enc.testnet'
});

(async () => {
  const res = await fetch(`https://api.twitter.com/2/tweets/1818213637326287003`, {
    headers: {
      Authorization: `Bearer ${process.env.TWITTER_API_BEARER_TOKEN_2}`
    }
  })
  console.log(process.env.TWITTER_API_BEARER_TOKEN_2)
  const body = await res.json()
  console.log(body)
})()
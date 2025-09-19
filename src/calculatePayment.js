const offerId = bytesArgs[0]
const requiredPostLiveDurationSeconds = BigInt(bytesArgs[1])
const maxCreatorPayment = BigInt(bytesArgs[2])

const backendRes = await Functions.makeHttpRequest({
  url: `${secrets.backendUrl}/fetch-offer-for-chainlink-function`,
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'api-key': secrets.apiKey,
  },
  data: {
    offerId,
  },
  timeout: 80000,
})
if (backendRes.error) {
  throw Error(`Backend Error ${backendRes?.code?.toString() ?? ''}: ${backendRes?.message ?? ''}`)
}

const offerData = backendRes.data
if (!offerData) {
  throw Error(`No offer data found`)
}

const tweetRes = await Functions.makeHttpRequest({
  url: `${secrets.backendUrl}/fetch-tweet`,
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'api-key': secrets.apiKey,
  },
  data: {
    tweetId: offerData.post_id,
  },
  timeout: 4000,
})

if (tweetRes.error) {
  throw Error(`Tweet Fetch Error: ${tweetRes?.code?.toString() ?? ''}: ${tweetRes?.message ?? ''}`)
}

if (!tweetRes.data.data && tweetRes.data?.errors) {
  throw Error(`Tweet Fetch Response Error: ${tweetRes.data?.errors?.[0]?.title}`)
}

if (!tweetRes.data.data) {
  throw Error(`Unexpected API Response`)
}
const tweetData = tweetRes.data.data

const postDateSeconds = BigInt(Math.floor(Date.parse(tweetData.created_at) / 1000))
const postLiveDurationSeconds = BigInt(Math.floor(Date.now() / 1000)) - postDateSeconds
if (postLiveDurationSeconds < requiredPostLiveDurationSeconds) {
  throw Error(`Tweet was not live long enough`)
}

return Functions.encodeUint256(maxCreatorPayment)

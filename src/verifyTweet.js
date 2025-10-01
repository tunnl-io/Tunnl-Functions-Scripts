const offerId = bytesArgs[0]
const requiredPostLiveDurationSeconds = BigInt(bytesArgs[1])
const advertiserAddress = bytesArgs[3]

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
  timeout: 8200,
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

if (!tweetData.author_id) {
  throw Error(`Tweet has no author ID`)
}

if (tweetData.author_id !== offerData.creator_twitter_id) {
  throw Error(`Author ID does not match creator_twitter_id`)
}

if (!tweetData.created_at) {
  throw Error(`Tweet has no creation date`)
}

const postDateSeconds = BigInt(Math.floor(Date.parse(tweetData.created_at) / 1000))
if (postDateSeconds < offerData.startDateSeconds || postDateSeconds > offerData.endDateSeconds) {
  throw Error(`Tweet was posted outside the offer window`)
}

if (postDateSeconds > BigInt(Math.floor(Date.now() / 1000)) - BigInt(60 * 60)) {
  throw Error(`Tweet was posted less than 1 hour ago`)
}

if (!tweetData.edit_history_tweet_ids) {
  throw Error(`Missing tweet edit history`)
}

if (tweetData.edit_history_tweet_ids.length > 1) {
  throw Error(`Tweet has been edited`)
}

const payoutDateSeconds = postDateSeconds + requiredPostLiveDurationSeconds
return Functions.encodeUint256(payoutDateSeconds)

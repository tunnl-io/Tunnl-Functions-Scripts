const offerId = bytesArgs[0]
const requiredPostLiveDurationSeconds = BigInt(bytesArgs[1])
const advertiserAddress = bytesArgs[3]

// Fetch private offer data from backend
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
  timeout: 4000,
})
if (backendRes.error) {
  throw Error(`Backend Error ${backendRes.status ?? ''}`)
}

const offerData = backendRes.data
if (!offerData) {
  throw Error(`No offer data found`)
}

const startDateSeconds = Math.floor(new Date(offerData.post_submission_start_date).getTime() / 1000)
const endDateSeconds = Math.floor(new Date(offerData.post_submission_end_date).getTime() / 1000)

// Verify the integrity of the offer data by ensuring the private data SHA256 hash matches the offerId
// UNUSED FOR NOW
// const offerDataToHash = {
//   salt: offerData.salt,
//   creator_twitter_id: offerData.creator_twitter_id,
//   required_likes: offerData.required_likes,
//   sponsorship_criteria: offerData.requirements,
//   start_date_seconds: startDateSeconds,
//   end_date_seconds: endDateSeconds,
// }
// const offerDataHash = await sha256(JSON.stringify(offerDataToHash))
// if (`0x${offerDataHash}` !== offerId) {
//   throw Error(`Offer data hash mismatch 0x${offerDataHash} !== ${offerId}`)
// }

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
  throw Error(`Tweet Fetch Error: ${tweetRes.status ?? ''}`)
}

if (tweetRes.data?.errors) {
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

// Ensure the post was made between the offer start and end dates
const postDateSeconds = BigInt(Math.floor(Date.parse(tweetData.created_at) / 1000))
if (postDateSeconds < offerData.startDateSeconds || postDateSeconds > offerData.endDateSeconds) {
  throw Error(`Tweet was posted outside the offer window`)
}
// Ensure the tweet is at least an hour old so it cannot be edited
if (postDateSeconds > BigInt(Math.floor(Date.now() / 1000)) - BigInt(60 * 60)) {
  throw Error(`Tweet was posted less than 1 hour ago`)
}

if (!tweetData.edit_history_tweet_ids) {
  throw Error(`Missing tweet edit history`)
}
// Ensure the tweet has not been edited
if (tweetData.edit_history_tweet_ids.length > 1) {
  throw Error(`Tweet has been edited`)
}

// We don't need to perform the AI verification as the backend will have already done this before calling submitTweet
const payoutDateSeconds = postDateSeconds + requiredPostLiveDurationSeconds
return Functions.encodeUint256(payoutDateSeconds)

// Library functions
// UNUSED FOR NOW
// async function sha256(text) {
//   const encoder = new TextEncoder()
//   const data = encoder.encode(text)
//   const hashBuffer = await crypto.subtle.digest("SHA-256", data)
//   const hashArray = Array.from(new Uint8Array(hashBuffer))
//   const hashHex = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("")
//   return hashHex
// }
const offerId = bytesArgs[0]
const payment = BigInt(bytesArgs[2])
const offerDurationSeconds = BigInt(bytesArgs[3])

// Fetch private offer data from backend
const backendRes = await Functions.makeHttpRequest({
  url: `
  https://seashell-app-npeyj.ondigitalocean.app/internal/fetch-offer-for-chainlink-function`, // TODO: @Lord-Jerry you can choose a different URL if you want.
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

const offerDataToHash = {
  salt: offerData.salt,
  creator_twitter_id: offerData.creator_twitter_id,
  required_likes: offerData.required_likes,
  sponsorship_criteria: offerData.requirements,
}
// Verify the integrity of the offer data by ensuring the private data SHA256 hash matches the offerId
const offerDataHash = await sha256(JSON.stringify(offerDataToHash))
if (`0x${offerDataHash}` !== offerId) {
  throw Error(`Offer data hash mismatch 0x${offerDataHash} !== ${offerId}`)
}

const twitterRes = await Functions.makeHttpRequest({
  url: `https://api.twitter.com/2/tweets/${offerData.post_id}`,
  headers: {
    Authorization: `Bearer ${secrets.twitterKey}`,
  },
  params: {
    'tweet.fields': 'created_at',
  },
  timeout: 4000,
})
if (twitterRes.error) {
  throw Error(`Twitter Error ${twitterRes.status ?? ''}`)
}

if (twitterRes.data?.errors) {
  // Future Improvement: If tweet is Not Found (ie: is no longer live), return 0 payment
  // (for mainnet beta, cancelling invalid offers w/ payout failures requires admin action)
  throw Error(`Twitter Error ${twitterRes.data?.errors?.[0]?.title}`)
}

if (!twitterRes.data?.data) {
  throw Error(`Unexpected Twitter API Response`)
}
const tweetData = twitterRes.data.data
if (!tweetData.created_at) {
  throw Error(`Tweet has no creation date`)
}

// The post must be live for offerDurationSeconds - 1 day
// The reason we subtrack 1 day is the creator has 24 hours to make the post after 1st accepting the offer
// (offer duration countdown does not start until after acceptance)
const postDateSeconds = BigInt(Math.floor(Date.parse(tweetData.created_at) / 1000))
if (postDateSeconds > BigInt(Math.floor(Date.now() / 1000)) - (offerDurationSeconds - BigInt(60 * 60 * 24))) {
  throw Error(`Tweet was not live long enough`)
}

// For the mainnet beta, we are not calculating payment based on any metrics (likes, views, etc.)
// Future Improvement: variable payment amount based on metrics
return Functions.encodeUint256(payment)

// Library functions

async function sha256(text) {
  const encoder = new TextEncoder()
  const data = encoder.encode(text)
  const hashBuffer = await crypto.subtle.digest("SHA-256", data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  const hashHex = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("")
  return hashHex
}
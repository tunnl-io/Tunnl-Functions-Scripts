const offerId = args[0]
const payment = BigInt(`0x${args[2]}`)
const offerDurationSeconds = BigInt(`0x${args[3]}`)

// Fetch private offer data from backend
const backendRes = await Functions.makeHttpRequest({
  url: `http://localhost:3000/api/offer/getOfferData`, // TODO: @Lord-Jerry you can choose a different URL if you want.
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  data: {
    // To further protect backend, the payload is encrypted w/ shared key
    encryptedData: await encrypt(JSON.stringify({ offerId: `0x${offerId}` }), secrets.key),
  },
  timeout: 4000,
})
if (backendRes.error) {
  throw Error(`Backend Error ${backendRes.status ?? ''}`)
}

// Decrypt & parse response data
const encryptedOfferData = backendRes.data?.data
if (!encryptedOfferData) {
  throw Error(`No offer data found`)
}
let offerData
try {
  offerData = await decrypt(encryptedOfferData, secrets.key)
} catch (e) {
  throw Error(`Failed to decrypt offer data`)
}
try {
  offerData = JSON.parse(offerData)
} catch (e) {
  throw Error(`Failed to parse offer data`)
}

// TODO: Payload structure needs to be updated to match @Lord-Jerry 's implementation in the backend
const offerDataToHash = {
  createdAt: offerData.createdAt,
  creator_twitter_id: offerData.creator_twitter_id,
  required_likes: offerData.required_likes,
  sponsorship_criteria: offerData.sponsorship_criteria,
}
// Verify the integrity of the offer data by ensuring the private data SHA256 hash matches the offerId
const offerDataHash = await sha256(JSON.stringify(offerDataToHash))
if (offerDataHash !== offerId) {
  throw Error(`Offer data hash mismatch`)
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

async function encrypt(data, encryptionKey) {
  const encoder = new TextEncoder()
  const dataBytes = encoder.encode(data)
  const keyBytes = hexToUint8Array(encryptionKey)
  const key = await crypto.subtle.importKey(
    "raw",
    keyBytes,
    { name: "AES-CBC" },
    false,
    ["encrypt"]
  )
  const iv = crypto.getRandomValues(new Uint8Array(16))
  const encryptedData = await crypto.subtle.encrypt(
    { name: "AES-CBC", iv },
    key,
    dataBytes
  )
  const encryptedBytes = new Uint8Array(iv.length + encryptedData.byteLength)
  encryptedBytes.set(iv)
  encryptedBytes.set(new Uint8Array(encryptedData), iv.length)
  return Array.from(encryptedBytes, (byte) => byte.toString(16).padStart(2, '0')).join('')
}

async function decrypt(encryptedData, encryptionKey) {
  const decoder = new TextDecoder()
  const iv = hexToUint8Array(encryptedData.slice(0, 32))
  const data = hexToUint8Array(encryptedData.slice(32))
  const keyBytes = hexToUint8Array(encryptionKey)
  const key = await crypto.subtle.importKey(
    "raw",
    keyBytes,
    { name: "AES-CBC" },
    false,
    ["decrypt"]
  )
  const decryptedData = await crypto.subtle.decrypt(
    { name: "AES-CBC", iv },
    key,
    data
  )
  return decoder.decode(decryptedData)
}

function hexToUint8Array(hexString) {
  return new Uint8Array(hexString.match(/.{1,2}/g).map((byte) => parseInt(byte, 16)))
}

async function sha256(text) {
  const encoder = new TextEncoder()
  const data = encoder.encode(text)
  const hashBuffer = await crypto.subtle.digest("SHA-256", data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  const hashHex = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("")
  return hashHex
}
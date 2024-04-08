const offerId = args[0]
const tweetId = await decrypt(args[1], secrets.key)
const maxPayment = BigInt(`0x${args[3]}`)

const twitterReq = Functions.makeHttpRequest({
  url: `https://api.twitter.com/2/tweets/${tweetId}`,
  headers: {
    Authorization: `Bearer ${secrets.twitterKey}`,
  },
  params: {
    'tweet.fields': 'public_metrics',
  },
  timeout: 9000,
})

const encryptedData = await encrypt(JSON.stringify({ offerId: `0x${offerId}` }), secrets.key)

const backendReq = Functions.makeHttpRequest({
  url: `https://tunnl-io-frontend.vercel.app/api/offer/getOfferData`,
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  data: {
    encryptedData,
  },
  timeout: 9000,
})

const [ twitterRes, backendRes ] = await Promise.all([twitterReq, backendReq])

if (backendRes.error) {
  throw Error(`RETRYABLE Backend HTTP Error ${backendRes.status}`)
}

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

const offerDataToHash = {
  createdAt: offerData.createdAt,
  creator_twitter_id: offerData.creator_twitter_id,
  required_likes: offerData.required_likes,
  sponsorship_criteria: offerData.sponsorship_criteria,
}
const offerDataHash = await sha256(JSON.stringify(offerDataToHash))
const requiredLikes = BigInt(offerData.required_likes)

if (offerDataHash !== offerId) {
  throw Error(`Offer data hash mismatch`)
}

if (twitterRes.error) {
  throw Error(`RETRYABLE Twitter HTTP Error ${twitterRes.status}`)
}

if (twitterRes.data?.errors) {
  throw Error(`API Error ${twitterRes.data?.errors?.[0]?.title}`)
}

if (!twitterRes.data?.data) {
  throw Error(`Unexpected API Response`)
}
const tweetData = twitterRes.data?.data

if (!tweetData.public_metrics?.like_count && tweetData.public_metrics?.like_count !== 0) {
  throw Error(`No like_count in API response`)
}
const likeCount = BigInt(tweetData.public_metrics.like_count)

const payment = likeCount >= requiredLikes
  ? maxPayment
  : (likeCount * maxPayment) / requiredLikes

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
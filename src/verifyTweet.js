const offerId = args[0]
const tweetId = await decrypt(args[1], secrets.key)
const creationDateSeconds = BigInt(`0x${args[2]}`)

const twitterReq = Functions.makeHttpRequest({
  url: `https://api.twitter.com/2/tweets/${tweetId}`,
  headers: {
    Authorization: `Bearer ${secrets.twitterKey}`,
  },
  params: {
    'tweet.fields': 'author_id,created_at,entities,referenced_tweets,note_tweet',
    expansions: 'edit_history_tweet_ids,referenced_tweets.id',
  },
})

const encryptedData = await encrypt(JSON.stringify({ offerId: `0x${offerId}` }), secrets.key)

const backendReq = Functions.makeHttpRequest({
  url: `https://tunnl-io-testnet.vercel.app/api/offer/getOfferData`,
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
  throw Error(`RETRYABLE Backend Error ${backendRes.status ?? ''}`)
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

if (offerDataHash !== offerId) {
  throw Error(`Offer data hash mismatch`)
}

if (twitterRes.error) {
  throw Error(`RETRYABLE Twitter Error ${twitterRes.status ?? ''}`)
}

if (twitterRes.data?.errors) {
  throw Error(`Twitter API Error ${twitterRes.data?.errors?.[0]?.title}`)
}

if (!twitterRes.data?.data) {
  throw Error(`Unexpected API Response`)
}
const tweetData = twitterRes.data.data

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

if (postDateSeconds < creationDateSeconds) {
  throw Error(`Tweet was posted before offer creation date`)
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

const tweetText = tweetData.note_tweet?.text
  ? insertUrls(tweetData.note_tweet.text, tweetData.note_tweet.entities)
  : insertUrls(tweetData.text, tweetData.entities)
const quotedTweetId = tweetData.referenced_tweets?.filter((tweet) => tweet.type === 'quoted').map((tweet) => tweet.id)
const repliedTweetId = tweetData.referenced_tweets?.filter((tweet) => tweet.type === 'replied_to').map((tweet) => tweet.id)

const prompt = `The requirements are:\n"${
  offerData.sponsorship_criteria
}"\n\nThe post text is:\n"${
  tweetText
}"${
  quotedTweetId?.length > 0
    ? `\nThe post quoted/reposted another post with an id of ${quotedTweetId[0]}.`
    : ''
}${
  repliedTweetId?.length > 0
    ? `\nThe post was a reply to a post with an id of ${repliedTweetId[0]}.`
    : ''
}\n\nDo you think the tweet meets the requirements?`

const aiRes = await Functions.makeHttpRequest({
  url: "https://api.openai.com/v1/chat/completions",
  method: "POST",
  headers: {
    Authorization: `Bearer ${secrets.openAiKey}`,
    "Content-Type": "application/json",
  },
  data: {
    model: "gpt-4",
    messages: [
      {
        role: "system",
        content: 'Your job is to determine if a given Twitter post meets the specified requirements and provide a one-word answer of either "yes" or "no". Please be flexible with your interpretation of the Twitter post and the requirements. Because this is a Twitter post, keep in mind that the post may contain slang, sarcasm, jargon, or newly invented words or language, especially related to Web3 and crypto. The primary goal is to detect if the post clearly violates the requirements, so if there is significant ambiguity or room for interpretation, err on the side of responding with "yes".'
      },
      { role: "user", content: prompt },
    ],
    temperature: 1.0,
  },
})

if (aiRes.error) {
  throw Error(`RETRYABLE AI Error ${aiRes.status ?? ''}`)
}

const aiData = aiRes.data?.choices?.[0]?.message?.content
if (!aiData) {
  throw Error(`Unexpected API Response`)
}

if (aiData.toLowerCase().includes('no')) {
  throw Error(`Tweet does not meet the requirements`)
}

if (aiData.toLowerCase().includes('yes')) {
  return new Uint8Array([1])
}

throw Error(`RETRYABLE Unexpected AI response neither yes or no`)

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

function insertUrls(tweetText, entities) {
  const urlEntities = entities?.urls
  if (!urlEntities) return tweetText
  let updatedText = tweetText
  for (const urlEntity of urlEntities) {
      const { url, expanded_url } = urlEntity
      updatedText = updatedText.replace(url, expanded_url)
  }
  return updatedText
}
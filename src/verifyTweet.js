const offerId = bytesArgs[0]
const creationDateSeconds = BigInt(bytesArgs[1])
const offerDurationSeconds = BigInt(bytesArgs[3])

// Fetch private offer data from backend
const backendRes = await Functions.makeHttpRequest({
  url: `
  https://seashell-app-npeyj.ondigitalocean.app/internal/fetch-offer-for-chainlink-function`,
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
    'tweet.fields': 'author_id,created_at,entities,referenced_tweets,note_tweet',
    expansions: 'edit_history_tweet_ids,referenced_tweets.id',
  },
  timeout: 4000,
})
if (twitterRes.error) {
  throw Error(`Twitter Error ${twitterRes.status ?? ''}`)
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

// Ensure the creator did not try to use an old tweet for this offer
const postDateSeconds = BigInt(Math.floor(Date.parse(tweetData.created_at) / 1000))
if (postDateSeconds < creationDateSeconds) {
  throw Error(`Tweet was posted before offer creation date`)
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

// Insert full URLs into tweet text
const tweetText = tweetData.note_tweet?.text
  ? insertUrls(tweetData.note_tweet.text, tweetData.note_tweet.entities)
  : insertUrls(tweetData.text, tweetData.entities)
// Insert context if this tweet is a quote or reply
const quotedTweetId = tweetData.referenced_tweets?.filter((tweet) => tweet.type === 'quoted').map((tweet) => tweet.id)
const repliedTweetId = tweetData.referenced_tweets?.filter((tweet) => tweet.type === 'replied_to').map((tweet) => tweet.id)

// Verify the post meets the requirements
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
    model: "gpt-4o",
    messages: [
      {
        role: "system",
        content: 'Your job is to determine if a given Twitter post meets the specified requirements and provide a one-word answer of either "yes" or "no". Please be flexible with your interpretation of the Twitter post and the requirements. Because this is a Twitter post, keep in mind that the post may contain slang, sarcasm, jargon, or newly invented words or language, especially related to Web3 and crypto. The primary goal is to detect if the post clearly violates the requirements, so if there is significant ambiguity or room for interpretation, err on the side of responding with "yes".'
      },
      { role: "user", content: prompt },
    ],
    temperature: 0,
  },
})

if (aiRes.error) {
  throw Error(`AI Error ${aiRes.status ?? ''}`)
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

throw Error(`Unexpected AI response neither yes or no`)

// Library functions

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
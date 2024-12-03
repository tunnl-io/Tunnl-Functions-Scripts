const offerId = bytesArgs[0]
const requiredPostLiveDurationSeconds = BigInt(bytesArgs[1])
const advertiserAddress = bytesArgs[3]

// Fetch private offer data from backend
const backendRes = await Functions.makeHttpRequest({
  url: secrets.backendUrl,
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

const offerDataToHash = {
  salt: offerData.salt,
  creator_twitter_id: offerData.creator_twitter_id,
  required_likes: offerData.required_likes,
  sponsorship_criteria: offerData.requirements,
  startDateSeconds,
  endDateSeconds,
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

// Instructions Prompt
const content = `Your job is to determine if a user's Twitter post meets the specified requirements.
Provide a one-word answer: either "Yes" if the post meets all requirements or "No" if it does not.
Be flexible with your interpretation, considering the nature of Twitter posts, which may contain slang, sarcasm, jargon, or new language, especially related to Web3, blockchain and crypto.
Ignore case mismatch issues unless explicitly specified.
The requirements may explicitly state that the post must reply to or quote a specific post referenced via URL (the post ID is contained within the URL).
Unless explicitly specified, the post cannot be a reply to another post. However, unless otherwise specified, it can quote another post. If the post is a reply or quotes another post, you will be given the referenced post ID.
Assume a positive intent of the user to meet the requirements and interpret the post generously, unless there is a clear violation of the requirements.`

// Insert full URLs into tweet text
const tweetText = tweetData.note_tweet?.text
  ? insertUrls(tweetData.note_tweet.text, tweetData.note_tweet.entities)
  : insertUrls(tweetData.text, tweetData.entities)
// Insert context if this tweet is a quote or reply
const quotedTweetId = tweetData.referenced_tweets?.filter((tweet) => tweet.type === 'quoted').map((tweet) => tweet.id)
const repliedTweetId = tweetData.referenced_tweets?.filter((tweet) => tweet.type === 'replied_to').map((tweet) => tweet.id)

// Verify the post meets the requirements
const prompt = `The requirements are:\n${
  offerData.requirements
}\n\n\nThe user's post text is:\n${
  tweetText
}${
  quotedTweetId?.length > 0
    ? `\n\n\nThe post quoted another post with an ID of ${quotedTweetId[0]}.`
    : '\n\n\nThe post did not quote another post.'
}${
  repliedTweetId?.length > 0
    ? `\nThe post was a reply to a post with an ID of ${repliedTweetId[0]}.`
    : '\nThe post is not a reply to another post.'
}\n\nDo you think the post meets the requirements?`

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
        content,
      },
      { role: "user", content: prompt },
    ],
    temperature: 0,
  },
  timeout: 9000,
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
  const payoutDateSeconds = postDateSeconds + requiredPostLiveDurationSeconds
  return encodeUint32(payoutDateSeconds)
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

function encodeUint32(num) {
  let hexStr = num.toString(16)
  hexStr = hexStr.padStart(8, '0')
  const arr = new Uint8Array(4)
  for (let i = 0; i < arr.length; i++) {
    arr[i] = parseInt(hexStr.slice(i * 2, i * 2 + 2), 16)
  }
  return arr
}
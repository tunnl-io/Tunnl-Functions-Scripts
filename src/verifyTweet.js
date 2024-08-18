const offerId = bytesArgs[0]
const creationDateSeconds = BigInt(bytesArgs[1])
const offerDurationSeconds = BigInt(bytesArgs[3])

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
console.log(backendRes)
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

// Instructions Prompt
const content = `Your task is to determine if a given Twitter post meets the specified instruction requirements. Provide a response with either a one word answer of "Yes" if the offer meets the requirements, or "No" followed by a brief explanation if the requirements were not met, ideally under 50 words. Please consider the following guidelines.
- Flexibility and Context Awareness: Be generous in interpreting the post and requirements and allow for creative expression. Keeping in mind that Twitter posts may contain typos, slang, sarcasm, jargon, or newly invented words, particularly in Web3 and crypto spaces.
- Names, Tags and URLs: Ensure that any names, # hashtags, $ cashtags, @ tags or URLs match exactly as required. However, the casing does not have to be an exact match.
- Focus on Clarity and Violation Detection: The primary goal is to detect clear violations of the requirements. Err on the side of flexibility unless the requirements specify an exact match is necessary.
- Personal Experience, Sentiment or Tone: If the requirement involves sharing personal experience, specific sentiment, or tone, ensure that the post aligns with this expectation. If the post reflects the correct sentiment or experience, consider it a match.
- Exact Phrasing vs. Intent: When the requirements clearly specify exact phrasing, ensure the post matches verbatim. However, if the requirement is more about intent or meaning, focus on whether the post conveys the intended message.
- Replies and Quotes: Unless otherwise specified in the requirements, the post should not be a reply to another post. However, unless otherwise specified, it can quote another post. If the post is a reply or quotes another post, you will be given the referenced tweet ID. The requirements may explicitly state that the post must reply to or quote a specific post referenced via URL (the post ID is contained within the URL).
The main goal is to determine if the post explicitly does not meet the requirements. If the requirements list multiple criteria, evaluate each one separately before responding. Before finalizing your decision, if any part of the post creates uncertainty, lean towards a "Yes" unless there is a clear and obvious mismatch. If the post intent clearly aligns with the requirements but there is a minor execution issue (e.g., a typo or slight deviation in wording), respond with "Yes".\n
Below are various examples:
Example #1: Script Match
- Requirements: Tweet the following script: "$Toshi token is the best crypto ticker to farm on @Base. Get in on the token airdrop now!"
- Post Content: $Toshi token is the best crypto ticker to farm on @Base. Get in on the token airdrop now!
- Response: Yes
Example #2: Script Mismatch
- Requirements: Tweet the following script: "$Toshi best ticker on @Base"
- Post Content: $Toshi best ticker
- Response: No, the post does not meet the requirements because it does not match the script.\n
Example #3: URL Mismatch
- Requirements: The post must encourage followers to test Tunnl and tag @tunnl_io as well as include the testnet URL https://tunnl-v2-preview.vercel.app
- Post Content: Test Tunnl!!! the URL is https://tunnl-preview.vercel.app @tunnl_io
- Response: No, the post does not meet the requirements because the URL does not match the requirements.\n
Example #4: Personal Experience
- Requirements: This post should talk about your experience testing the Tunnl beta. Must tag the Tunnl X account: @Tunnl_io Must include the hashtag: #Tunnl
- Post Content: 🚨BREAKING $LINK FUNCTIONS NEWS🚨 @Tunnl_io IS A SOCIAL MEDIA MONETIZATION PLATFORM THAT UTILIZES @CHAINLINK FUNCTIONS, ARTIFICIAL INTELLIGENCE & SMART CONTRACTS TO ALLOW INDIVIDUALS THE OPPORTUNITY TO EARN MONEY IN COLLABORATION WITH CORPORATIONS WHO WANT A SOCIAL MEDIA ADVERTISEMENT PRESENCE. THE STEPS ARE SIMPLE: 1. CONNECT YOUR TWITTER 2. FOLLOW THE RULES OUTLINED BY THE COMPANY REQUESTING THE ADVERTISEMENT & POST THE CONTENT BASED ON THE PROPOSED TOPIC 3. GET PAID. GREAT EXPERIENCE TESTING #Tunnl ...THIS APP IS IN BETA
- Response: Yes
Example #5: Sentiment Analysis
- Requirements: The post must express excitement about the upcoming Tunnl launch and include the hashtag #Tunnl
- Post Content: The web3 industry is an unmitigated disaster, but Tunnl is really cool! The launch is gonna be huge! #Tunnl
- Response: Yes`
// TODO: Test both reply and quote scenarios
// TODO: In backend, we must ignore quotes & replies for draft verification!!!!

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
}\n\n${
  quotedTweetId?.length > 0
    ? `\nThe post quoted another post with an id of ${quotedTweetId[0]}.`
    : '\nThe post did not quote another post.'
}${
  repliedTweetId?.length > 0
    ? `\nThe post was a reply to a post with an id of ${repliedTweetId[0]}.`
    : '\nThe post did not quote another post.'
}\n\nDo you think the tweet meets the requirements?`

console.log(content)
console.log("------")
console.log(prompt)

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
  console.log(aiRes)
  throw Error(`AI Error ${aiRes.status ?? ''}`)
}

const aiData = aiRes.data?.choices?.[0]?.message?.content
if (!aiData) {
  throw Error(`Unexpected API Response`)
}

console.log(aiData)

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

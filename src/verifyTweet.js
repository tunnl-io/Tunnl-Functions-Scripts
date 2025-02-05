const offerId = bytesArgs[0]

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

const currentTimeInSeconds = Math.floor(Date.now() / 1000)

if (offerData.is_vote_verified) {
  // Return the current time so the payout will occur immediately
  return Functions.encodeUint256(currentTimeInSeconds)
}

throw Error('Unable to verify offer vote.')

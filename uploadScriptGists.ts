import { createGist } from "@chainlink/functions-toolkit";
import { readFileSync } from "fs";

const sha256 = async (text: string) => {
  return Array.from(
    new Uint8Array(
      await crypto.subtle.digest(
        "SHA-256",
        new TextEncoder().encode(text)
      )
    )).map(
      (b)=>b.toString(16).padStart(2,"0")
    ).join("")
}

(async () => {
  const verifyScriptString = readFileSync('./src/verifyTweet.js', 'utf8')
  
  const verifyScriptHash = await sha256(verifyScriptString)
  console.log('\nverifyTweet script hash:', verifyScriptHash)

  const verifyScriptGistUrl = await createGist(process.env.GITHUB_TOKEN!, verifyScriptHash)
  console.log('verifyTweet script uploaded to:', verifyScriptGistUrl)
  console.log('Update the Functions secrets object with this URL for verifyScriptUrl (ie: process.env.VERIFY_SCRIPT_URL)')

  const payScriptString = readFileSync('./src/calculatePayment.js', 'utf8')
  
  const payScriptHash = await sha256(payScriptString)
  console.log('\ncalculatePayment script hash:', payScriptHash)

  const payScriptGistUrl = await createGist(process.env.GITHUB_TOKEN!, payScriptString)
  console.log('calculatePayment script uploaded to:', payScriptGistUrl)
  console.log('Update the Functions secrets object with this URL for payScriptUrl (ie: process.env.PAY_SCRIPT_URL)')
})()
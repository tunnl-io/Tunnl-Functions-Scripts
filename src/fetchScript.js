const scriptSHA = '' // TODO

const backendReq = Functions.makeHttpRequest({ url: secrets.src })

// Fetch string, decrypt & eval

const decrypt = async (enc, key) => {
  return new TextDecoder().decode(
    await crypto.subtle.decrypt(
      { name: "AES-CBC", iv: hexToArr(enc.slice(0, 32)) },
      await crypto.subtle.importKey(
        "raw",
        hexToArr(key),
        { name: "AES-CBC" },
        false,
        ["decrypt"]
      ),
      hexToArr(enc.slice(32)),
    )
  )
}

const hexToArr = (hexString) => {
  return new Uint8Array(
    hexString.match(/.{1,2}/g).map((byte) => parseInt(byte, 16))
  )
}

const sha256 = async (text) => {
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
const s = (await Functions.makeHttpRequest({url:secrets.verifyScriptUrl,responseType:'text'})).data
if(Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(s)))).map((b)=>b.toString(16).padStart(2,"0")).join("")!=='14dc4418035c8b9e362fa318fc708fa984be699f0747b20dc1f9354f1d2baa8c'){throw Error('Script hash mismatch')}
return eval(`(async()=>{${s}})()`)
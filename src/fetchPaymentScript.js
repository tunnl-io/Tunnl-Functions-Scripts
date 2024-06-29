const s = (await Functions.makeHttpRequest({url:secrets.payScriptUrl,responseType:'text'})).data
if(Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(s)))).map((b)=>b.toString(16).padStart(2,"0")).join("")!=='5a0aa0eae615efaefe1c7d2733a14ac6c608de1d8f611b5194a7bb374e8d0c4f'){throw Error('Script hash mismatch')}
return eval(`(async()=>{${s}})()`)
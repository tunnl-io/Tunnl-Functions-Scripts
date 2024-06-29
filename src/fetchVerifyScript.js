const s = (await Functions.makeHttpRequest({url:secrets.verifyScriptUrl,responseType:'text'})).data
if(Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(s)))).map((b)=>b.toString(16).padStart(2,"0")).join("")!=='7317f1fd8bb0812d19888c0c1536be006a1ea8be11125faca3184b4dc1602dd5'){throw Error('Script hash mismatch')}
return eval(`(async()=>{${s}})()`)
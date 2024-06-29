const s = (await Functions.makeHttpRequest({url:secrets.payScriptUrl,responseType:'text'})).data
if(Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(s)))).map((b)=>b.toString(16).padStart(2,"0")).join("")!=='0986180f60fc55ff67732e051259d52fb08ed15bab388717a40c04f25b5c09b6'){throw Error('Script hash mismatch')}
return eval(`(async()=>{${s}})()`)
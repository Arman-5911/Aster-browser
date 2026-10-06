/** Runs in the page world. Keep self-contained: Electron serializes this function.
 * No IPC, Node, remote code, network requests or browser-control APIs here.
 * Only known ad metadata at player-response boundaries is removed.
 */
export function protectYouTubePlayer(){
  const clean=(value:unknown):unknown=>{
    if(!value||typeof value!=='object')return value;
    const response=value as Record<string,unknown>;
    // Do not recursively rewrite arbitrary page data, streams, captions or playlists.
    if('videoDetails'in response||'playabilityStatus'in response){
      for(const key of ['adPlacements','playerAds','adSlots']){
        const descriptor=Object.getOwnPropertyDescriptor(response,key);
        if(descriptor?.configurable)Reflect.deleteProperty(response,key);
      }
    }
    const nested=response.playerResponse;
    if(nested&&typeof nested==='object'&&nested!==value)cleanPlayer(nested as Record<string,unknown>);
    return value;
  };
  const cleanPlayer=(response:Record<string,unknown>)=>{
    for(const key of ['adPlacements','playerAds','adSlots']){
      const descriptor=Object.getOwnPropertyDescriptor(response,key);
      if(descriptor?.configurable)Reflect.deleteProperty(response,key);
    }
    return response;
  };
  for(const key of ['ytInitialPlayerResponse','playerResponse']){
    const root=window as unknown as Record<string,unknown>;
    const descriptor=Object.getOwnPropertyDescriptor(root,key);
    if(descriptor&&!descriptor.configurable)continue;
    if(descriptor?.get||descriptor?.set)continue;
    let value=root[key];
    if(value&&typeof value==='object')cleanPlayer(value as Record<string,unknown>);
    Object.defineProperty(root,key,{configurable:true,enumerable:descriptor?.enumerable??true,
      get:()=>value,set:next=>{value=next&&typeof next==='object'?cleanPlayer(next):next;}});
  }
  const parse=JSON.parse;
  JSON.parse=new Proxy(parse,{apply(target,thisArg,args){return clean(Reflect.apply(target,thisArg,args));}});
  // fetch Response.json bypasses the page's JSON.parse implementation.
  const json=Response.prototype.json;
  Response.prototype.json=new Proxy(json,{apply(target,thisArg,args){return Reflect.apply(target,thisArg,args).then(clean);}});
}

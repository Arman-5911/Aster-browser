/** Serialized into the isolated top-frame world. The user explicitly chose Fill. */
export function fillLogin(entry:{origin:string;username:string;password:string}){
  if(location.protocol!=='https:'||location.origin!==entry.origin||window!==window.top)return false;
  const visible=(input:HTMLInputElement)=>{
    if(!input.isConnected||input.matches(':disabled')||input.readOnly||input.closest('[inert]'))return false;
    const rect=input.getBoundingClientRect();if(rect.width<=0||rect.height<=0||rect.bottom<=0||rect.right<=0||rect.top>=innerHeight||rect.left>=innerWidth)return false;
    for(let node:HTMLElement|null=input;node;node=node.parentElement){const style=getComputedStyle(node);if(style.visibility!=='visible'||style.display==='none'||Number(style.opacity)===0)return false;}
    return true;
  };
  const passwords=[...document.querySelectorAll<HTMLInputElement>('input[type=password]')].filter(input=>visible(input)&&input.autocomplete!=='new-password');
  if(passwords.length!==1)return false;const password=passwords[0],form=password.form;
  if(!form||form.method.toLowerCase()!=='post'||new URL(form.action||location.href,location.href).origin!==entry.origin)return false;
  const usernames=[...form.querySelectorAll<HTMLInputElement>('input[autocomplete=username],input[type=email],input[type=text],input:not([type])')].filter(visible);
  if(usernames.length!==1)return false;
  const setter=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')!.set!;
  setter.call(usernames[0],entry.username);setter.call(password,entry.password);
  for(const input of [usernames[0],password]){input.dispatchEvent(new Event('input',{bubbles:true}));input.dispatchEvent(new Event('change',{bubbles:true}));}
  return true;
}

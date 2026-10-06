export interface RequestRecord{id:number;url:string;method:string;type:string;status?:number;error?:string;elapsed?:number;result:string;started:number}
export interface ResponsiveSize{width:number;height:number}
export interface DeveloperSnapshot{recording:boolean;requests:RequestRecord[];responsive?:ResponsiveSize;message:string}
export function inspectorUrl(value:string){try{const u=new URL(value);return u.origin+u.pathname.slice(0,2000);}catch{return '(invalid URL)';}}
export function formatJson(input:string,minify=false){if(input.length>500000)throw new Error('Use JSON smaller than 500,000 characters.');return JSON.stringify(JSON.parse(input),null,minify?undefined:2);}

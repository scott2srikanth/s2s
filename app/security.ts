import {env} from "cloudflare:workers";
const enc=new TextEncoder(),dec=new TextDecoder();
export class TotpConfigurationError extends Error{constructor(){super("TOTP encryption is not configured");this.name="TotpConfigurationError"}}
async function key(){const worker=env as unknown as {TOTP_ENCRYPTION_KEY?:string},raw=worker.TOTP_ENCRYPTION_KEY||(typeof process!=="undefined"?process.env.TOTP_ENCRYPTION_KEY:undefined);if(!raw||raw.length<32)throw new TotpConfigurationError();return crypto.subtle.importKey("raw",enc.encode(raw.slice(0,32)),{name:"AES-GCM"},false,["encrypt","decrypt"])}
export async function encrypt(value:string){const iv=crypto.getRandomValues(new Uint8Array(12)),data=await crypto.subtle.encrypt({name:"AES-GCM",iv},await key(),enc.encode(value));return btoa(String.fromCharCode(...iv))+"."+btoa(String.fromCharCode(...new Uint8Array(data)))}
export async function decrypt(value:string){const[a,b]=value.split("."),iv=Uint8Array.from(atob(a),c=>c.charCodeAt(0)),data=Uint8Array.from(atob(b),c=>c.charCodeAt(0));return dec.decode(await crypto.subtle.decrypt({name:"AES-GCM",iv},await key(),data))}
export async function hash(value:string){const data=await crypto.subtle.digest("SHA-256",enc.encode(value));return [...new Uint8Array(data)].map(x=>x.toString(16).padStart(2,"0")).join("")}
export function recoveryCodes(){return Array.from({length:8},()=>crypto.randomUUID().replaceAll("-","").slice(0,10).toUpperCase())}

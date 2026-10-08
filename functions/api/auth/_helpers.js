const E=new TextEncoder();
export function json(data,status=200,headers={}){return new Response(JSON.stringify(data),{status,headers:{"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store",...headers}})}
export function cookie(request,name){for(const part of(request.headers.get("Cookie")||"").split(";")){const [key,...value]=part.trim().split("=");if(key===name)return decodeURIComponent(value.join("="))}return null}
export function hex(buffer){return [...new Uint8Array(buffer)].map(value=>value.toString(16).padStart(2,"0")).join("")}
export function randomHex(length=32){const value=new Uint8Array(length);crypto.getRandomValues(value);return hex(value)}
export async function hashPassword(password,saltHex){const salt=new Uint8Array(saltHex.match(/.{2}/g).map(value=>parseInt(value,16)));const key=await crypto.subtle.importKey("raw",E.encode(password),"PBKDF2",false,["deriveBits"]);return hex(await crypto.subtle.deriveBits({name:"PBKDF2",salt,iterations:210000,hash:"SHA-256"},key,256))}
export function safeEqual(a,b){if(typeof a!=="string"||typeof b!=="string"||a.length!==b.length)return false;let result=0;for(let i=0;i<a.length;i++)result|=a.charCodeAt(i)^b.charCodeAt(i);return result===0}
export async function currentUser(request,env){const sessionId=cookie(request,"sk_session");if(!sessionId)return null;return env.DB.prepare(`SELECT u.*,s.expires_at AS session_expires_at FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.id=? AND s.expires_at>datetime('now')`).bind(sessionId).first()}


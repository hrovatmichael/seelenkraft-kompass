import { onRequestPost as originalLogin } from "./_login-original.js";
import { reply, sameOrigin, savePreference } from "../_newsletter.js";
export async function onRequestPost(context) {
 const {request,env}=context;
 if(!sameOrigin(request)) return reply({error:"Ungültiger Ursprung."},403);
 let body;try{body=await request.clone().json();}catch{return reply({error:"Ungültige Anmeldedaten."},400);}
 if(body.newsletterAccepted!==undefined && typeof body.newsletterAccepted!=="boolean") return reply({error:"Ungültige Newsletter-Einstellung."},400);
 const response=await originalLogin(context);
 if(!response.ok || body.newsletterAccepted!==true) return response;
 try {
  const user=await env.DB.prepare("SELECT id FROM users WHERE username=? COLLATE NOCASE LIMIT 1").bind(String(body.username||"").trim()).first();
  if(!user) throw new Error("Benutzer nicht gefunden.");
  await savePreference(env,user.id,true);
  return response;
 }catch(e){
  console.error("Newsletter-Speicherung:",e);
  let data;try{data=await response.clone().json();}catch{return response;}
  data.newsletterWarning="Anmeldung erfolgreich. Die Newsletter-Zustimmung wurde nicht gespeichert. Bitte im Konto erneut versuchen und die E-Mail-Adresse prüfen.";
  return new Response(JSON.stringify(data),{status:response.status,headers:response.headers});
 }
}

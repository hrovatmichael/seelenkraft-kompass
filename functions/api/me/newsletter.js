import { currentUser } from "../auth/_helpers.js";
import { reply, sameOrigin, savePreference } from "../_newsletter.js";
export async function onRequestGet({request,env}) {
 try {
  const user = await currentUser(request,env);
  if (!user) return reply({error:"Nicht angemeldet."},401);
  const row = await env.DB.prepare("SELECT accepted,updated_at FROM newsletter_preferences WHERE user_id=?").bind(user.id).first();
  return reply({accepted:row?.accepted===1,updatedAt:row?.updated_at||null});
 } catch(e) { console.error(e); return reply({error:"Newsletter-Einstellung konnte nicht geladen werden."},500); }
}
export async function onRequestPut({request,env}) {
 if (!sameOrigin(request)) return reply({error:"Ungültiger Ursprung."},403);
 try {
  const user=await currentUser(request,env);
  if (!user) return reply({error:"Nicht angemeldet."},401);
  let body; try {body=await request.json();} catch {return reply({error:"Ungültige Eingabe."},400);}
  if(typeof body.accepted!=="boolean") return reply({error:"Zustimmung muss true oder false sein."},400);
  try {await savePreference(env,user.id,body.accepted);} catch(e) {
   if(e.message.startsWith("Bitte zuerst")) return reply({error:e.message},400);
   throw e;
  }
  return reply({ok:true,accepted:body.accepted});
 } catch(e) {console.error(e);return reply({error:"Newsletter-Einstellung konnte nicht gespeichert werden."},500);}
}

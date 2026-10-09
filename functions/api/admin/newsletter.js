import { currentUser } from "../auth/_helpers.js";
import { reply } from "../_newsletter.js";
export async function onRequestGet({request,env}) {
 try {
  const user=await currentUser(request,env);
  if(!user) return reply({error:"Nicht angemeldet."},401);
  if(user.role!=="admin") return reply({error:"Nur für Administratoren."},403);
  const result=await env.DB.prepare(`SELECT u.id,u.username,u.display_name AS displayName,
   u.email,n.accepted_at AS acceptedAt FROM newsletter_preferences n
   JOIN users u ON u.id=n.user_id
   WHERE n.accepted=1 AND trim(COALESCE(u.email,''))<>''
   AND lower(trim(u.email))=lower(trim(n.email))
   ORDER BY u.username COLLATE NOCASE`).all();
  return reply({users:result.results||[]});
 }catch(e){console.error(e);return reply({error:"Newsletter-Liste konnte nicht geladen werden."},500);}
}

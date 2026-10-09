import { currentUser } from "../auth/_helpers.js";
import { reply } from "../_newsletter.js";
export async function onRequestGet({request,env}) {
 try {
  const auth=await currentUser(request,env);
  if(!auth)return reply({authenticated:false,error:"Nicht angemeldet."},401);
  const u=await env.DB.prepare(`SELECT id,username,display_name,email,role,created_at,
   first_login_at,last_login_at,access_expires_at FROM users WHERE id=?`).bind(auth.id).first();
  if(!u)return reply({authenticated:false,error:"Benutzer nicht gefunden."},401);
  return reply({authenticated:true,user:{id:u.id,username:u.username,displayName:u.display_name,
   email:u.email,role:u.role,createdAt:u.created_at,firstLoginAt:u.first_login_at,
   lastLoginAt:u.last_login_at,accessExpiresAt:u.access_expires_at}});
 }catch(e){console.error(e);return reply({error:"Kontodaten konnten nicht geladen werden."},500);}
}

import{json,hashPassword,randomHex,safeEqual}from"./_helpers.js";
export async function onRequestPost({request,env}){
 let body;try{body=await request.json()}catch{return json({error:"Ungültige Anfrage."},400)}
 const username=String(body.username||"").trim(),password=String(body.password||"");
 if(!username||!password)return json({error:"Benutzername und Passwort sind erforderlich."},400);
 const user=await env.DB.prepare(`SELECT * FROM users WHERE username=? COLLATE NOCASE`).bind(username).first();
 if(!user||!user.is_active)return json({error:"Benutzername oder Passwort ist nicht richtig."},401);
 const [salt,stored]=String(user.password_hash).split(":");
 if(!salt||!stored||!safeEqual(await hashPassword(password,salt),stored))return json({error:"Benutzername oder Passwort ist nicht richtig."},401);
 if(user.role!=="admin"&&(!user.access_expires_at||Date.parse(user.access_expires_at)<=Date.now()))return json({error:"Dieser Zugang ist abgelaufen."},403);
 const id=randomHex(),maxAge=604800,expiresAt=new Date(Date.now()+maxAge*1000).toISOString();
 await env.DB.batch([env.DB.prepare(`DELETE FROM sessions WHERE expires_at<=datetime('now')`),env.DB.prepare(`INSERT INTO sessions(id,user_id,expires_at) VALUES(?,?,?)`).bind(id,user.id,expiresAt),env.DB.prepare(`UPDATE users SET last_login_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE id=?`).bind(user.id)]);
 return json({success:true,user:{role:user.role}},200,{"Set-Cookie":`sk_session=${id}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`});
}

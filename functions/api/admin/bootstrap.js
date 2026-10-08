import{json,randomHex,hashPassword}from"../auth/_helpers.js";
export async function onRequestPost({request,env}){
 if(!env.BOOTSTRAP_SECRET||request.headers.get("Authorization")!==`Bearer ${env.BOOTSTRAP_SECRET}`)return json({error:"Nicht autorisiert."},401);
 if(await env.DB.prepare(`SELECT id FROM users WHERE role='admin' LIMIT 1`).first())return json({error:"Ein Admin existiert bereits."},409);
 let body;try{body=await request.json()}catch{return json({error:"Ungültige Anfrage."},400)}
 const username=String(body.username||"").trim(),password=String(body.password||""),displayName=String(body.displayName||"").trim(),email=String(body.email||"").trim()||null;
 if(username.length<3||password.length<10||!displayName)return json({error:"Benutzername, Anzeigename und ein Passwort mit mindestens 10 Zeichen sind erforderlich."},400);
 const salt=randomHex(16),hash=await hashPassword(password,salt);
 await env.DB.prepare(`INSERT INTO users(username,email,display_name,password_hash,role,is_active) VALUES(?,?,?,?, 'admin',1)`).bind(username,email,displayName,`${salt}:${hash}`).run();
 return json({success:true});
}

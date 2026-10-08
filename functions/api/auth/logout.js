import{json,cookie}from"./_helpers.js";
export async function onRequestPost({request,env}){const id=cookie(request,"sk_session");if(id)await env.DB.prepare(`DELETE FROM sessions WHERE id=?`).bind(id).run();return json({success:true},200,{"Set-Cookie":"sk_session=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0"})}

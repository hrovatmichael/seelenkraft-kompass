"use strict";
(async()=>{
 const form=document.getElementById("newsletterForm"),box=document.getElementById("accountNewsletter"),button=document.getElementById("newsletterSave"),message=document.getElementById("newsletterMessage");
 const warning=sessionStorage.getItem("newsletterWarning");if(warning){message.textContent=warning;sessionStorage.removeItem("newsletterWarning");}
 try{
  const r=await fetch("/api/me/newsletter",{credentials:"same-origin",cache:"no-store"});const d=await r.json();if(!r.ok)throw new Error(d.error);
  box.checked=d.accepted;box.disabled=false;button.disabled=false;
 }catch(e){message.textContent=e.message;}
 form.addEventListener("submit",async e=>{e.preventDefault();button.disabled=true;box.disabled=true;
  try{const r=await fetch("/api/me/newsletter",{method:"PUT",credentials:"same-origin",headers:{"Content-Type":"application/json"},body:JSON.stringify({accepted:box.checked})});const d=await r.json();if(!r.ok)throw new Error(d.error);message.textContent=d.accepted?"Newsletter-Zustimmung gespeichert.":"Du bist vom Newsletter abgemeldet.";}
  catch(e){message.textContent=e.message;}finally{button.disabled=false;box.disabled=false;}
 });
})();

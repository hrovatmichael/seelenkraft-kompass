"use strict";
document.getElementById("loginForm").addEventListener("submit",async event=>{
 event.preventDefault();const button=document.getElementById("loginButton"),message=document.getElementById("loginMessage");button.disabled=true;message.textContent="";
 try {
  const body={username:document.getElementById("username").value.trim(),password:document.getElementById("password").value};
  if(document.getElementById("newsletterAccepted").checked)body.newsletterAccepted=true;
  const response=await fetch("/api/auth/login",{method:"POST",credentials:"same-origin",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});
  const data=await response.json();if(!response.ok)throw new Error(data.error||"Anmeldung fehlgeschlagen.");
  if(data.newsletterWarning){sessionStorage.setItem("newsletterWarning",data.newsletterWarning);location.assign("/konto.html");}
  else location.assign("/index.html");
 }catch(e){message.textContent=e.message;button.disabled=false;}
});

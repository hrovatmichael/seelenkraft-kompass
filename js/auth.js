"use strict";
const form=document.getElementById("loginForm");
const message=document.getElementById("loginMessage");
form.addEventListener("submit",async event=>{
 event.preventDefault(); message.textContent="";
 try{
  const response=await fetch("/api/auth/login",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({username:form.username.value.trim(),password:form.password.value})});
  const data=await response.json();
  if(!response.ok) throw new Error(data.error||"Anmeldung fehlgeschlagen.");
  location.href=data.user.role==="admin"?"/admin/benutzer.html":"/index.html";
 }catch(error){message.textContent=error.message;}
});

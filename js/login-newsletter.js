"use strict";
document.getElementById("loginForm").addEventListener("submit",async event=>{
 event.preventDefault();const button=document.getElementById("loginButton"),message=document.getElementById("loginMessage");button.disabled=true;message.textContent="";
 try {
  const body={username:document.getElementById("username").value.trim(),password:document.getElementById("password").value};
  if(document.getElementById("newsletterAccepted").checked)body.newsletterAccepted=true;
  const response=await fetch("/api/auth/login",{method:"POST",credentials:"same-origin",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});
  const raw = await response.text();

if (!raw.trim()) {
    throw new Error(
        `Login-API liefert eine leere Antwort (HTTP ${response.status}).`
    );
}

let data;

try {
    data = JSON.parse(raw);
} catch {
    console.error("Login-Antwort:", {
        status: response.status,
        body: raw
    });

    throw new Error(
        `Login-API liefert kein gültiges JSON (HTTP ${response.status}).`
    );
}

if (!response.ok) {
    throw new Error(data.error || "Anmeldung fehlgeschlagen.");
}
  if(data.newsletterWarning){sessionStorage.setItem("newsletterWarning",data.newsletterWarning);location.assign("/konto.html");}
  else location.assign("/index.html");
 }catch(e){message.textContent=e.message;button.disabled=false;}
});

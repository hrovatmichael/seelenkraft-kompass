"use strict";
(async()=>{const message=document.getElementById("adminMessage");try{
 const r=await fetch("/api/admin/newsletter",{credentials:"same-origin",cache:"no-store"});const d=await r.json();if(!r.ok)throw new Error(d.error);
 const users=d.users||[];document.getElementById("newsletterCount").textContent=users.length+" Benutzer mit Zustimmung";
 const rows=document.getElementById("newsletterRows");
 users.forEach(u=>{const tr=document.createElement("tr");[u.username,u.displayName||"–",u.email,u.acceptedAt?new Date(u.acceptedAt).toLocaleString("de-AT"):"–"].forEach(value=>{const td=document.createElement("td");td.textContent=value;tr.append(td);});rows.append(tr);});
 document.getElementById("newsletterAdmin").hidden=false;message.textContent=users.length?"":"Noch keine Newsletter-Zustimmungen vorhanden.";
 document.getElementById("copyEmails").addEventListener("click",async()=>{try{await navigator.clipboard.writeText([...new Set(users.map(u=>u.email.trim().toLowerCase()))].join("; "));message.textContent="E-Mail-Adressen kopiert.";}catch{message.textContent="Kopieren wurde vom Browser blockiert. Bitte die Adressen aus der Tabelle markieren.";}});
}catch(e){message.textContent=e.message;}})();

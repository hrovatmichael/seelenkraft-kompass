"use strict";
(async()=>{try{
 const r=await fetch("/api/me/account",{credentials:"same-origin",cache:"no-store"});if(!r.ok)return;const d=await r.json();
 if(d.user?.role!=="admin")return;
 const menu=document.querySelector(".menu");if(!menu||menu.querySelector(".newsletter-menu-item"))return;
 const a=document.createElement("a");a.href="/admin/newsletter.html";a.className="menu-item newsletter-menu-item";a.textContent="E-Mails für Newsletter";
 if(location.pathname==="/admin/newsletter.html"){a.classList.add("active");a.setAttribute("aria-current","page");}menu.append(a);
}catch(e){console.error("Newsletter-Menü konnte nicht geladen werden.");}})();

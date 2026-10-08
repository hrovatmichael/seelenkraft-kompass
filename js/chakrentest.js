"use strict";
(()=>{
const Q=[
["Ich sehne mich nach mehr Vertrauen und innerem Frieden.","krone"],
["Ich halte mich zurück, obwohl ich etwas sagen möchte.","hals"],
["Es fällt mir schwer, etwas Vergangenes loszulassen.","herz"],
["Freude, Genuss oder Kreativität kommen derzeit zu kurz.","sakral"],
["Ich vertraue meiner inneren Stimme weniger, als ich gerne würde.","stirn"],
["Ich wünsche mir mehr Sicherheit, Ruhe oder Stabilität.","wurzel"],
["Ich wünsche mir mehr Leichtigkeit und Lebensfreude.","sakral"],
["Es fällt mir schwer, Nein zu sagen.","solar"],
["Ich wünsche mir mehr Verbindung zu mir selbst.","krone"],
["Ich zweifle öfter an mir oder an meinen Entscheidungen.","solar"],
["Veränderungen bringen mich schnell aus dem Gleichgewicht.","wurzel"],
["Ich passe mich an, statt meine Wünsche klar auszusprechen.","hals"],
["Ich trage Belastungen mit mir herum, die eigentlich nicht zu mir gehören.","herz"],
["Ich denke viel nach und verliere dabei manchmal mein Gefühl.","stirn"],
["Ich frage mich öfter, was meinem Leben Sinn gibt.","krone"],
["Ich versuche oft, es allen recht zu machen.","hals"],
["Ich wünsche mir mehr Mut, für mich selbst einzustehen.","solar"],
["Ein Beziehungsthema beschäftigt mich derzeit besonders.","herz"],
["Ich wünsche mir mehr Klarheit darüber, was wirklich zu mir passt.","stirn"],
["Ich habe oft das Gefühl, einfach nur zu funktionieren.","wurzel"],
["Meine eigenen Bedürfnisse kommen oft zu kurz.","sakral"]];
const C={wurzel:["Wurzelchakra","#b4564e"],sakral:["Sakralchakra","#c77b45"],solar:["Solarplexuschakra","#cfaa45"],herz:["Herzchakra","#718e72"],hals:["Halschakra","#668e9e"],stirn:["Stirnchakra","#66718f"],krone:["Kronenchakra","#8b7495"]};
const $=s=>document.querySelector(s),start=$("#startTest"),test=$("#testContainer"),result=$("#resultContainer");
if(!start||!test||!result)return;
let n=0,A=Array(Q.length).fill(null);
const style=document.createElement("style");style.textContent=`
.testCard,.resultCard{max-width:900px;margin:0 auto;padding:42px;background:#fffdf9;border:1px solid #e2ddd4;border-radius:28px}.testHead{display:flex;justify-content:space-between;color:#82786f;font-size:13px;font-weight:700}.progress{height:8px;margin:14px 0 38px;background:#ebe7df;border-radius:99px;overflow:hidden}.progress i{display:block;height:100%;background:#4f7064}.question{margin:0 auto 38px;max-width:760px;font:500 clamp(27px,4vw,40px)/1.25 Georgia,serif;text-align:center;color:#27352f}.answers{display:grid;grid-template-columns:1fr 1fr;gap:16px;max-width:650px;margin:auto}.answers button,.restart{min-height:54px;padding:13px 20px;border:1px solid #e2ddd4;border-radius:16px;background:#f7f4ef;color:#27352f;font:700 16px Arial;cursor:pointer}.answers button:hover,.answers button.sel,.restart{background:#4f7064;color:#fff;border-color:#4f7064}.back{display:block;margin:25px auto 0;border:0;background:none;color:#82786f;font-weight:700;cursor:pointer}.back:disabled{visibility:hidden}.resultCard h2{text-align:center;font:500 clamp(32px,5vw,50px) Georgia,serif;color:#27352f}.resultIntro,.note{text-align:center}.rows{display:grid;gap:13px;margin:30px 0}.row{display:grid;grid-template-columns:210px 1fr 70px;gap:16px;align-items:center;padding:15px;background:#f7f4ef;border-radius:15px}.name{font-weight:700}.track{height:10px;background:#e7e2da;border-radius:99px;overflow:hidden}.fill{height:100%}.score{text-align:right;font-weight:700;color:#82786f}.focus{padding:22px;background:#f1eee8;border-radius:18px;text-align:center}.focus strong{display:block;font:500 27px Georgia,serif;color:#27352f}.note{margin-top:24px;color:#82786f;font-size:13px}.restart{display:block;margin:26px auto 0;border-radius:99px}@media(max-width:700px){.testCard,.resultCard{padding:28px 20px}.answers{grid-template-columns:1fr}.row{grid-template-columns:1fr auto}.track{grid-column:1/-1;grid-row:2}}
`;document.head.append(style);
function showStart(v){[".hero",".intro-card",".start-area"].forEach(s=>{const e=$(s);if(e)e.hidden=!v})}
function begin(){n=0;A.fill(null);showStart(false);result.hidden=true;test.hidden=false;draw();test.scrollIntoView({behavior:"smooth"})}
function draw(){const p=Math.round((n+1)/Q.length*100);test.innerHTML=`<div class="testCard"><div class="testHead"><span>FRAGE ${n+1} VON ${Q.length}</span><span>${p} %</span></div><div class="progress"><i style="width:${p}%"></i></div><h2 class="question"></h2><div class="answers"><button data-v="1">Ja, trifft zu</button><button data-v="0">Nein, trifft nicht zu</button></div><button class="back" ${n?"":"disabled"}>← Zurück</button></div>`;test.querySelector(".question").textContent=Q[n][0];test.querySelectorAll("[data-v]").forEach(b=>{if(A[n]===Boolean(+b.dataset.v))b.classList.add("sel");b.onclick=()=>answer(Boolean(+b.dataset.v))});test.querySelector(".back").onclick=()=>{n--;draw()}}
function answer(v){A[n]=v;if(n<Q.length-1){n++;draw();test.scrollIntoView({behavior:"smooth"})}else results()}
function results(){const S=Object.fromEntries(Object.keys(C).map(k=>[k,0]));A.forEach((v,i)=>{if(v)S[Q[i][1]]++});const max=Math.max(...Object.values(S));const focus=max?Object.keys(S).filter(k=>S[k]===max).map(k=>C[k][0]).join(" · "):"Kein deutlicher Schwerpunkt";test.hidden=true;result.hidden=false;result.innerHTML=`<div class="resultCard"><h2>Deine persönliche Momentaufnahme</h2><p class="resultIntro">Die Auswertung zeigt, welche Lebensbereiche im Moment möglicherweise mehr Aufmerksamkeit wünschen.</p><div class="rows">${Object.entries(C).map(([k,v])=>`<div class="row"><div class="name">${v[0]}</div><div class="track"><div class="fill" style="width:${S[k]/3*100}%;background:${v[1]}"></div></div><div class="score">${S[k]} von 3</div></div>`).join("")}</div><div class="focus"><span>Aktueller Schwerpunkt</span><strong>${focus}</strong></div><p class="note">Spielerische energetische Selbsteinschätzung. Keine medizinische, psychologische oder therapeutische Diagnose oder Beratung.</p><button class="restart">Test neu starten</button></div>`;result.querySelector(".restart").onclick=begin;result.scrollIntoView({behavior:"smooth"})}
start.addEventListener("click",begin);
})();

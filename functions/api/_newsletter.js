export const CONSENT_TEXT = "Ja, ich möchte den Newsletter mit Neuigkeiten, neuen Produkten und Angeboten von Seelenkraft-Energetik erhalten. Ich kann mich jederzeit wieder abmelden.";
export const CONSENT_VERSION = "newsletter-v1";
export function reply(data, status = 200) {
 return new Response(JSON.stringify(data), {status, headers: {"Content-Type":"application/json; charset=utf-8", "Cache-Control":"no-store"}});
}
export function sameOrigin(request) {
 return request.headers.get("Origin") === new URL(request.url).origin;
}
export async function savePreference(env, userId, accepted) {
 const user = await env.DB.prepare("SELECT email FROM users WHERE id = ?").bind(userId).first();
 if (!user) throw new Error("Benutzer nicht gefunden.");
 const email = String(user.email || "").trim();
 if (accepted && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Bitte zuerst eine gültige E-Mail-Adresse im Benutzerkonto hinterlegen lassen.");
 const now = new Date().toISOString();
 await env.DB.prepare(`INSERT INTO newsletter_preferences
 (user_id,accepted,email,consent_text,consent_version,accepted_at,revoked_at,updated_at)
 VALUES (?,?,?,?,?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET
 accepted=excluded.accepted,email=excluded.email,consent_text=excluded.consent_text,
 consent_version=excluded.consent_version,
 accepted_at=CASE WHEN excluded.accepted=1 THEN excluded.accepted_at ELSE newsletter_preferences.accepted_at END,
 revoked_at=excluded.revoked_at,updated_at=excluded.updated_at`)
 .bind(userId,accepted?1:0,email,CONSENT_TEXT,CONSENT_VERSION,accepted?now:null,accepted?null:now,now).run();
}

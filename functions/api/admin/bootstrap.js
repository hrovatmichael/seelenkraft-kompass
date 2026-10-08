import {
    json,
    randomHex,
    hashPassword
} from "../auth/_helpers.js";

export async function onRequestPost({ request, env }) {
    try {
        if (!env.DB) {
            return json({
                error: "Die D1-Datenbank ist nicht als DB verbunden."
            }, 500);
        }

        if (!env.BOOTSTRAP_SECRET) {
            return json({
                error: "BOOTSTRAP_SECRET fehlt in Cloudflare."
            }, 500);
        }

        const authorization = request.headers.get("Authorization") || "";
        const expectedAuthorization = `Bearer ${env.BOOTSTRAP_SECRET}`;

        if (authorization !== expectedAuthorization) {
            return json({
                error: "Nicht autorisiert."
            }, 401);
        }

        const existingAdmin = await env.DB
            .prepare(`
                SELECT id
                FROM users
                WHERE role = 'admin'
                LIMIT 1
            `)
            .first();

        if (existingAdmin) {
            return json({
                error: "Ein Admin existiert bereits."
            }, 409);
        }

        let body;

        try {
            body = await request.json();
        } catch {
            return json({
                error: "Die übermittelten Daten sind ungültig."
            }, 400);
        }

        const username = String(body.username || "").trim();
        const password = String(body.password || "");
        const displayName = String(body.displayName || "").trim();
        const email = String(body.email || "").trim() || null;

        if (username.length < 3) {
            return json({
                error: "Der Benutzername muss mindestens 3 Zeichen haben."
            }, 400);
        }

        if (password.length < 10) {
            return json({
                error: "Das Passwort muss mindestens 10 Zeichen haben."
            }, 400);
        }

        if (!displayName) {
            return json({
                error: "Der Anzeigename ist erforderlich."
            }, 400);
        }

        const existingUsername = await env.DB
            .prepare(`
                SELECT id
                FROM users
                WHERE username = ? COLLATE NOCASE
                LIMIT 1
            `)
            .bind(username)
            .first();

        if (existingUsername) {
            return json({
                error: "Dieser Benutzername ist bereits vergeben."
            }, 409);
        }

        const salt = randomHex(16);
        const passwordHash = await hashPassword(password, salt);
        const storedPassword = `${salt}:${passwordHash}`;

        const result = await env.DB
            .prepare(`
                INSERT INTO users (
                    username,
                    email,
                    display_name,
                    password_hash,
                    role,
                    is_active,
                    access_expires_at,
                    created_at,
                    updated_at
                )
                VALUES (?, ?, ?, ?, 'admin', 1, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
            `)
            .bind(
                username,
                email,
                displayName,
                storedPassword
            )
            .run();

        return json({
            success: true,
            message: "Der erste Administrator wurde erfolgreich angelegt.",
            adminId: result.meta?.last_row_id || null
        });
    } catch (error) {
        console.error("Bootstrap-Fehler:", error);

        return json({
            error: "Admin konnte nicht angelegt werden.",
            details: error instanceof Error
                ? error.message
                : String(error)
        }, 500);
    }
}

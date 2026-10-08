import {
    json,
    hashPassword,
    randomHex,
    safeEqual
} from "./_helpers.js";

export async function onRequestPost({ request, env }) {
    try {
        if (!env.DB) {
            return json({
                error: "Die D1-Datenbank ist nicht als DB verbunden."
            }, 500);
        }

        let body;

        try {
            body = await request.json();
        } catch {
            return json({
                error: "Die übermittelten Anmeldedaten sind ungültig."
            }, 400);
        }

        const username = String(
            body.username || ""
        ).trim();

        const password = String(
            body.password || ""
        );

        if (!username || !password) {
            return json({
                error: "Benutzername und Passwort sind erforderlich."
            }, 400);
        }

        const user = await env.DB
            .prepare(`
                SELECT
                    id,
                    username,
                    email,
                    display_name,
                    password_hash,
                    role,
                    is_active,
                    access_expires_at,
                    first_login_at,
                    last_login_at,
                    created_at,
                    updated_at
                FROM users
                WHERE username = ? COLLATE NOCASE
                LIMIT 1
            `)
            .bind(username)
            .first();

        if (!user || !user.is_active) {
            return json({
                error: "Benutzername oder Passwort ist nicht richtig."
            }, 401);
        }

        const storedPassword = String(
            user.password_hash || ""
        );

        const [
            salt,
            storedHash
        ] = storedPassword.split(":");

        if (!salt || !storedHash) {
            return json({
                error: "Das Benutzerkonto ist nicht korrekt eingerichtet."
            }, 500);
        }

        const calculatedHash = await hashPassword(
            password,
            salt
        );

        if (
            !safeEqual(
                calculatedHash,
                storedHash
            )
        ) {
            return json({
                error: "Benutzername oder Passwort ist nicht richtig."
            }, 401);
        }

        /*
         * Administratoren besitzen Vollzugriff und benötigen
         * deshalb kein Ablaufdatum.
         */
        if (user.role !== "admin") {
            if (!user.access_expires_at) {
                return json({
                    error: "Für diesen Benutzer wurde keine Gültigkeitsdauer festgelegt."
                }, 403);
            }

            const expirationTime = Date.parse(
                user.access_expires_at
            );

            if (
                Number.isNaN(expirationTime) ||
                expirationTime <= Date.now()
            ) {
                return json({
                    error: "Dieser Zugang ist abgelaufen."
                }, 403);
            }
        }

        const sessionId = randomHex(32);

        /*
         * Die Session bleibt sieben Tage gültig.
         * Die Gültigkeitsdauer des Benutzerzugangs wird
         * zusätzlich bei jeder Anmeldung geprüft.
         */
        const sessionMaxAge = 60 * 60 * 24 * 7;

        const sessionExpiresAt = new Date(
            Date.now() +
            sessionMaxAge * 1000
        ).toISOString();

        await env.DB.batch([
            /*
             * Abgelaufene Sessions entfernen.
             */
            env.DB
                .prepare(`
                    DELETE FROM sessions
                    WHERE expires_at <= datetime('now')
                `),

            /*
             * Neue Session anlegen.
             */
            env.DB
                .prepare(`
                    INSERT INTO sessions (
                        id,
                        user_id,
                        expires_at,
                        created_at,
                        last_seen_at
                    )
                    VALUES (
                        ?,
                        ?,
                        ?,
                        CURRENT_TIMESTAMP,
                        CURRENT_TIMESTAMP
                    )
                `)
                .bind(
                    sessionId,
                    user.id,
                    sessionExpiresAt
                ),

            /*
             * Der erste Login wird nur einmal gespeichert.
             * Der letzte Login wird bei jeder Anmeldung aktualisiert.
             */
            env.DB
                .prepare(`
                    UPDATE users
                    SET
                        first_login_at = COALESCE(
                            first_login_at,
                            CURRENT_TIMESTAMP
                        ),
                        last_login_at = CURRENT_TIMESTAMP,
                        updated_at = CURRENT_TIMESTAMP
                    WHERE id = ?
                `)
                .bind(user.id)
        ]);

        let daysRemaining = null;

        if (
            user.role !== "admin" &&
            user.access_expires_at
        ) {
            daysRemaining = Math.ceil(
                (
                    Date.parse(
                        user.access_expires_at
                    ) -
                    Date.now()
                ) /
                86400000
            );
        }

        return json({
            success: true,

            message: "Anmeldung erfolgreich.",

            user: {
                id: Number(user.id),
                username: user.username,
                email: user.email || "",
                displayName: user.display_name,
                role: user.role,
                fullAccess: user.role === "admin",
                accessExpiresAt:
                    user.access_expires_at || null,
                firstLoginAt:
                    user.first_login_at || null,
                lastLoginAt:
                    new Date().toISOString(),
                createdAt:
                    user.created_at || null,
                daysRemaining,
                showRenewButton:
                    user.role !== "admin" &&
                    daysRemaining !== null &&
                    daysRemaining <= 7
            }
        }, 200, {
            "Set-Cookie":
                `sk_session=${encodeURIComponent(sessionId)}; ` +
                "Path=/; " +
                "HttpOnly; " +
                "Secure; " +
                "SameSite=Lax; " +
                `Max-Age=${sessionMaxAge}`
        });
    } catch (error) {
        console.error(
            "Fehler bei der Anmeldung:",
            error
        );

        return json({
            error: "Die Anmeldung ist fehlgeschlagen.",
            details: error instanceof Error
                ? error.message
                : String(error)
        }, 500);
    }
}

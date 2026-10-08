import {
    json,
    currentUser,
    randomHex,
    hashPassword
} from "../auth/_helpers.js";

const VALID_CHAKRAS = new Set([
    "wurzel",
    "sakral",
    "solar",
    "herz",
    "hals",
    "stirn",
    "krone"
]);

export async function onRequestPost({ request, env }) {
    try {
        if (!env.DB) {
            return json({
                error: "Die D1-Datenbank ist nicht als DB verbunden."
            }, 500);
        }

        const admin = await currentUser(request, env);

        if (!admin) {
            return json({
                error: "Du bist nicht angemeldet."
            }, 401);
        }

        if (admin.role !== "admin") {
            return json({
                error: "Nur Administratoren dürfen Benutzer anlegen."
            }, 403);
        }

        let body;

        try {
            body = await request.json();
        } catch {
            return json({
                error: "Die übermittelten Daten sind ungültig."
            }, 400);
        }

        const displayName = String(
            body.displayName || ""
        ).trim();

        const username = String(
            body.username || ""
        ).trim();

        const email = String(
            body.email || ""
        ).trim() || null;

        const password = String(
            body.password || ""
        );

        const accessExpiresAt = String(
            body.accessExpiresAt || ""
        ).trim();

        const isActive = body.isActive === false ? 0 : 1;

        const requestedChakras = Array.isArray(body.chakras)
            ? body.chakras
            : [];

        const chakras = [
            ...new Set(
                requestedChakras
                    .map(value => String(value).trim())
                    .filter(value => VALID_CHAKRAS.has(value))
            )
        ];

        if (!displayName) {
            return json({
                error: "Der Anzeigename ist erforderlich."
            }, 400);
        }

        if (username.length < 3) {
            return json({
                error: "Der Benutzername muss mindestens 3 Zeichen enthalten."
            }, 400);
        }

        if (!/^[a-zA-Z0-9._-]+$/.test(username)) {
            return json({
                error: "Der Benutzername darf nur Buchstaben, Zahlen, Punkte, Bindestriche und Unterstriche enthalten."
            }, 400);
        }

        if (password.length < 10) {
            return json({
                error: "Das Passwort muss mindestens 10 Zeichen enthalten."
            }, 400);
        }

        if (!accessExpiresAt) {
            return json({
                error: "Bitte lege fest, wie lange der Zugang gültig ist."
            }, 400);
        }

        if (!/^\d{4}-\d{2}-\d{2}$/.test(accessExpiresAt)) {
            return json({
                error: "Das Gültigkeitsdatum ist ungültig."
            }, 400);
        }

        const expirationDate = new Date(
            `${accessExpiresAt}T23:59:59.000Z`
        );

        if (Number.isNaN(expirationDate.getTime())) {
            return json({
                error: "Das Gültigkeitsdatum ist ungültig."
            }, 400);
        }

        if (expirationDate.getTime() <= Date.now()) {
            return json({
                error: "Das Gültigkeitsdatum muss in der Zukunft liegen."
            }, 400);
        }

        if (
            email &&
            !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
        ) {
            return json({
                error: "Die E-Mail-Adresse ist ungültig."
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

        if (email) {
            const existingEmail = await env.DB
                .prepare(`
                    SELECT id
                    FROM users
                    WHERE email = ? COLLATE NOCASE
                    LIMIT 1
                `)
                .bind(email)
                .first();

            if (existingEmail) {
                return json({
                    error: "Diese E-Mail-Adresse wird bereits verwendet."
                }, 409);
            }
        }

        const salt = randomHex(16);
        const passwordHash = await hashPassword(
            password,
            salt
        );

        const storedPassword = `${salt}:${passwordHash}`;

        const insertResult = await env.DB
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
                VALUES (
                    ?,
                    ?,
                    ?,
                    ?,
                    'user',
                    ?,
                    ?,
                    CURRENT_TIMESTAMP,
                    CURRENT_TIMESTAMP
                )
            `)
            .bind(
                username,
                email,
                displayName,
                storedPassword,
                isActive,
                expirationDate.toISOString()
            )
            .run();

        const userId = Number(
            insertResult.meta?.last_row_id
        );

        if (!userId) {
            return json({
                error: "Der Benutzer konnte nicht angelegt werden."
            }, 500);
        }

        if (chakras.length > 0) {
            const chakraPlaceholders = chakras
                .map(() => "?")
                .join(", ");

            const chakraResult = await env.DB
                .prepare(`
                    SELECT
                        id,
                        chakra_key
                    FROM chakras
                    WHERE chakra_key IN (${chakraPlaceholders})
                      AND is_active = 1
                `)
                .bind(...chakras)
                .all();

            const chakraRows = chakraResult.results || [];

            const insertStatements = chakraRows.map(chakra => {
                return env.DB
                    .prepare(`
                        INSERT OR IGNORE INTO user_chakras (
                            user_id,
                            chakra_id,
                            granted_at,
                            granted_by
                        )
                        VALUES (
                            ?,
                            ?,
                            CURRENT_TIMESTAMP,
                            ?
                        )
                    `)
                    .bind(
                        userId,
                        chakra.id,
                        admin.id
                    );
            });

            if (insertStatements.length > 0) {
                await env.DB.batch(insertStatements);
            }
        }

        const createdUser = await env.DB
            .prepare(`
                SELECT
                    id,
                    username,
                    email,
                    display_name,
                    role,
                    is_active,
                    access_expires_at,
                    last_login_at,
                    created_at,
                    updated_at
                FROM users
                WHERE id = ?
            `)
            .bind(userId)
            .first();

        return json({
            success: true,
            message: "Der Benutzer wurde erfolgreich angelegt.",
            user: {
                id: Number(createdUser.id),
                username: createdUser.username,
                email: createdUser.email || "",
                displayName: createdUser.display_name,
                role: createdUser.role,
                isActive: Boolean(createdUser.is_active),
                accessExpiresAt:
                    createdUser.access_expires_at,
                lastLoginAt:
                    createdUser.last_login_at || null,
                createdAt:
                    createdUser.created_at || null,
                updatedAt:
                    createdUser.updated_at || null,
                chakras
            }
        }, 201);
    } catch (error) {
        console.error(
            "Fehler beim Anlegen des Benutzers:",
            error
        );

        const details = error instanceof Error
            ? error.message
            : String(error);

        if (
            details.includes("UNIQUE constraint failed: users.username")
        ) {
            return json({
                error: "Dieser Benutzername ist bereits vergeben."
            }, 409);
        }

        if (
            details.includes("UNIQUE constraint failed: users.email")
        ) {
            return json({
                error: "Diese E-Mail-Adresse wird bereits verwendet."
            }, 409);
        }

        return json({
            error: "Der Benutzer konnte nicht angelegt werden.",
            details
        }, 500);
    }
}

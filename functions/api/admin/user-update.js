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

export async function onRequestPut({ request, env }) {
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
                error: "Nur Administratoren dürfen Benutzer bearbeiten."
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

        const userId = Number(body.userId);
        const accessExpiresAt = String(
            body.accessExpiresAt || ""
        ).trim();

        const isActive = body.isActive === false ? 0 : 1;
        const password = String(body.password || "");

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

        if (!Number.isInteger(userId) || userId <= 0) {
            return json({
                error: "Die Benutzer-ID ist ungültig."
            }, 400);
        }

        const user = await env.DB
            .prepare(`
                SELECT
                    id,
                    username,
                    email,
                    display_name,
                    role,
                    is_active,
                    access_expires_at
                FROM users
                WHERE id = ?
                LIMIT 1
            `)
            .bind(userId)
            .first();

        if (!user) {
            return json({
                error: "Der Benutzer wurde nicht gefunden."
            }, 404);
        }

        if (user.role === "admin") {
            return json({
                error: "Das Administratorkonto kann hier nicht verändert werden."
            }, 403);
        }

        if (!accessExpiresAt) {
            return json({
                error: "Bitte lege ein Gültigkeitsdatum fest."
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

        if (password && password.length < 10) {
            return json({
                error: "Das neue Passwort muss mindestens 10 Zeichen enthalten."
            }, 400);
        }

        const updateStatements = [];

        if (password) {
            const salt = randomHex(16);
            const passwordHash = await hashPassword(
                password,
                salt
            );

            updateStatements.push(
                env.DB
                    .prepare(`
                        UPDATE users
                        SET
                            password_hash = ?,
                            is_active = ?,
                            access_expires_at = ?,
                            updated_at = CURRENT_TIMESTAMP
                        WHERE id = ?
                          AND role = 'user'
                    `)
                    .bind(
                        `${salt}:${passwordHash}`,
                        isActive,
                        expirationDate.toISOString(),
                        userId
                    )
            );

            /*
             * Nach einer Passwortänderung werden alle bestehenden
             * Sitzungen dieses Benutzers beendet.
             */
            updateStatements.push(
                env.DB
                    .prepare(`
                        DELETE FROM sessions
                        WHERE user_id = ?
                    `)
                    .bind(userId)
            );
        } else {
            updateStatements.push(
                env.DB
                    .prepare(`
                        UPDATE users
                        SET
                            is_active = ?,
                            access_expires_at = ?,
                            updated_at = CURRENT_TIMESTAMP
                        WHERE id = ?
                          AND role = 'user'
                    `)
                    .bind(
                        isActive,
                        expirationDate.toISOString(),
                        userId
                    )
            );

            /*
             * Wird ein Zugang deaktiviert, werden vorhandene
             * Sitzungen ebenfalls entfernt.
             */
            if (!isActive) {
                updateStatements.push(
                    env.DB
                        .prepare(`
                            DELETE FROM sessions
                            WHERE user_id = ?
                        `)
                        .bind(userId)
                );
            }
        }

        /*
         * Alle bisherigen Chakra-Freigaben werden gelöscht.
         * Danach werden nur die aktuell ausgewählten Freigaben
         * wieder angelegt.
         */
        updateStatements.push(
            env.DB
                .prepare(`
                    DELETE FROM user_chakras
                    WHERE user_id = ?
                `)
                .bind(userId)
        );

        if (chakras.length > 0) {
            const placeholders = chakras
                .map(() => "?")
                .join(", ");

            const chakraResult = await env.DB
                .prepare(`
                    SELECT
                        id,
                        chakra_key
                    FROM chakras
                    WHERE chakra_key IN (${placeholders})
                      AND is_active = 1
                `)
                .bind(...chakras)
                .all();

            const chakraRows = chakraResult.results || [];

            for (const chakra of chakraRows) {
                updateStatements.push(
                    env.DB
                        .prepare(`
                            INSERT INTO user_chakras (
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
                        )
                );
            }
        }

        await env.DB.batch(updateStatements);

        const updatedUser = await env.DB
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

        const updatedChakrasResult = await env.DB
            .prepare(`
                SELECT
                    c.chakra_key
                FROM user_chakras uc
                INNER JOIN chakras c
                    ON c.id = uc.chakra_id
                WHERE uc.user_id = ?
                ORDER BY c.sort_order ASC
            `)
            .bind(userId)
            .all();

        const updatedChakras = (
            updatedChakrasResult.results || []
        ).map(row => row.chakra_key);

        return json({
            success: true,
            message: "Die Änderungen wurden erfolgreich gespeichert.",
            user: {
                id: Number(updatedUser.id),
                username: updatedUser.username,
                email: updatedUser.email || "",
                displayName: updatedUser.display_name,
                role: updatedUser.role,
                isActive: Boolean(updatedUser.is_active),
                accessExpiresAt:
                    updatedUser.access_expires_at,
                lastLoginAt:
                    updatedUser.last_login_at || null,
                createdAt:
                    updatedUser.created_at || null,
                updatedAt:
                    updatedUser.updated_at || null,
                chakras: updatedChakras
            }
        });
    } catch (error) {
        console.error(
            "Fehler beim Aktualisieren des Benutzers:",
            error
        );

        return json({
            error: "Die Änderungen konnten nicht gespeichert werden.",
            details: error instanceof Error
                ? error.message
                : String(error)
        }, 500);
    }
}

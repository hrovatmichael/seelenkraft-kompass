import {
    json,
    currentUser
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

async function requireAdmin(request, env) {
    const admin = await currentUser(request, env);

    if (!admin) {
        return {
            error: json({
                error: "Du bist nicht angemeldet."
            }, 401)
        };
    }

    if (admin.role !== "admin") {
        return {
            error: json({
                error: "Nur Administratoren dürfen Chakra-Freigaben verwalten."
            }, 403)
        };
    }

    return {
        admin
    };
}

function normalizeChakras(values) {
    if (!Array.isArray(values)) {
        return [];
    }

    return [
        ...new Set(
            values
                .map(value => String(value).trim())
                .filter(value => VALID_CHAKRAS.has(value))
        )
    ];
}

export async function onRequestGet({ request, env }) {
    try {
        if (!env.DB) {
            return json({
                error: "Die D1-Datenbank ist nicht als DB verbunden."
            }, 500);
        }

        const authorization = await requireAdmin(
            request,
            env
        );

        if (authorization.error) {
            return authorization.error;
        }

        const url = new URL(request.url);
        const userId = Number(
            url.searchParams.get("userId")
        );

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
                    display_name,
                    role
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

        /*
         * Administratoren besitzen grundsätzlich Vollzugriff
         * auf alle aktiven Chakra-Seiten.
         */
        if (user.role === "admin") {
            const allChakrasResult = await env.DB
                .prepare(`
                    SELECT
                        chakra_key,
                        title,
                        sort_order,
                        page_path
                    FROM chakras
                    WHERE is_active = 1
                    ORDER BY sort_order ASC
                `)
                .all();

            const allChakras = (
                allChakrasResult.results || []
            ).map(chakra => ({
                key: chakra.chakra_key,
                title: chakra.title,
                sortOrder: Number(chakra.sort_order),
                pagePath: chakra.page_path
            }));

            return json({
                success: true,
                fullAccess: true,
                user: {
                    id: Number(user.id),
                    username: user.username,
                    displayName: user.display_name,
                    role: user.role
                },
                chakras: allChakras.map(
                    chakra => chakra.key
                ),
                chakraDetails: allChakras
            });
        }

        const chakraResult = await env.DB
            .prepare(`
                SELECT
                    c.chakra_key,
                    c.title,
                    c.sort_order,
                    c.page_path,
                    uc.granted_at,
                    uc.granted_by
                FROM user_chakras uc
                INNER JOIN chakras c
                    ON c.id = uc.chakra_id
                WHERE uc.user_id = ?
                  AND c.is_active = 1
                ORDER BY c.sort_order ASC
            `)
            .bind(userId)
            .all();

        const chakraDetails = (
            chakraResult.results || []
        ).map(chakra => ({
            key: chakra.chakra_key,
            title: chakra.title,
            sortOrder: Number(chakra.sort_order),
            pagePath: chakra.page_path,
            grantedAt: chakra.granted_at || null,
            grantedBy: chakra.granted_by
                ? Number(chakra.granted_by)
                : null
        }));

        return json({
            success: true,
            fullAccess: false,
            user: {
                id: Number(user.id),
                username: user.username,
                displayName: user.display_name,
                role: user.role
            },
            chakras: chakraDetails.map(
                chakra => chakra.key
            ),
            chakraDetails
        });
    } catch (error) {
        console.error(
            "Fehler beim Laden der Chakra-Freigaben:",
            error
        );

        return json({
            error: "Die Chakra-Freigaben konnten nicht geladen werden.",
            details: error instanceof Error
                ? error.message
                : String(error)
        }, 500);
    }
}

export async function onRequestPut({ request, env }) {
    try {
        if (!env.DB) {
            return json({
                error: "Die D1-Datenbank ist nicht als DB verbunden."
            }, 500);
        }

        const authorization = await requireAdmin(
            request,
            env
        );

        if (authorization.error) {
            return authorization.error;
        }

        const admin = authorization.admin;

        let body;

        try {
            body = await request.json();
        } catch {
            return json({
                error: "Die übermittelten Daten sind ungültig."
            }, 400);
        }

        const userId = Number(body.userId);
        const chakras = normalizeChakras(
            body.chakras
        );

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
                    display_name,
                    role
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
                error: "Der Administrator besitzt bereits Vollzugriff auf alle Chakra-Seiten."
            }, 403);
        }

        const statements = [
            env.DB
                .prepare(`
                    DELETE FROM user_chakras
                    WHERE user_id = ?
                `)
                .bind(userId)
        ];

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
                    ORDER BY sort_order ASC
                `)
                .bind(...chakras)
                .all();

            const chakraRows =
                chakraResult.results || [];

            for (const chakra of chakraRows) {
                statements.push(
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

        await env.DB.batch(statements);

        const updatedResult = await env.DB
            .prepare(`
                SELECT
                    c.chakra_key,
                    c.title,
                    c.sort_order,
                    c.page_path,
                    uc.granted_at
                FROM user_chakras uc
                INNER JOIN chakras c
                    ON c.id = uc.chakra_id
                WHERE uc.user_id = ?
                  AND c.is_active = 1
                ORDER BY c.sort_order ASC
            `)
            .bind(userId)
            .all();

        const chakraDetails = (
            updatedResult.results || []
        ).map(chakra => ({
            key: chakra.chakra_key,
            title: chakra.title,
            sortOrder: Number(chakra.sort_order),
            pagePath: chakra.page_path,
            grantedAt: chakra.granted_at || null
        }));

        return json({
            success: true,
            message: "Die Chakra-Freigaben wurden gespeichert.",
            user: {
                id: Number(user.id),
                username: user.username,
                displayName: user.display_name
            },
            chakras: chakraDetails.map(
                chakra => chakra.key
            ),
            chakraDetails
        });
    } catch (error) {
        console.error(
            "Fehler beim Speichern der Chakra-Freigaben:",
            error
        );

        return json({
            error: "Die Chakra-Freigaben konnten nicht gespeichert werden.",
            details: error instanceof Error
                ? error.message
                : String(error)
        }, 500);
    }
}

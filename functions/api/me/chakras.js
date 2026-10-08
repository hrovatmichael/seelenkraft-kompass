import {
    json,
    currentUser
} from "../auth/_helpers.js";

export async function onRequestGet({ request, env }) {
    try {
        if (!env.DB) {
            return json({
                error: "Die D1-Datenbank ist nicht als DB verbunden."
            }, 500);
        }

        const user = await currentUser(request, env);

        if (!user) {
            return json({
                authenticated: false,
                chakras: []
            }, 401);
        }

        if (!user.is_active) {
            return json({
                error: "Dieser Benutzerzugang ist deaktiviert."
            }, 403);
        }

        if (
            user.role !== "admin" &&
            (
                !user.access_expires_at ||
                Date.parse(user.access_expires_at) <= Date.now()
            )
        ) {
            return json({
                error: "Dieser Benutzerzugang ist abgelaufen."
            }, 403);
        }

        /*
         * Der Administrator erhält automatisch alle
         * aktiven Chakra-Seiten.
         */
        if (user.role === "admin") {
            const result = await env.DB
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

            const chakras = (result.results || []).map(row => ({
                key: row.chakra_key,
                title: row.title,
                sortOrder: Number(row.sort_order),
                pagePath: row.page_path
            }));

            return json({
                authenticated: true,
                fullAccess: true,

                user: {
                    id: Number(user.id),
                    username: user.username,
                    displayName: user.display_name,
                    role: user.role,
                    accessExpiresAt: user.access_expires_at
                },

                chakras
            });
        }

        const result = await env.DB
            .prepare(`
                SELECT
                    c.chakra_key,
                    c.title,
                    c.sort_order,
                    c.page_path
                FROM user_chakras uc

                INNER JOIN chakras c
                    ON c.id = uc.chakra_id

                WHERE uc.user_id = ?
                  AND c.is_active = 1

                ORDER BY c.sort_order ASC
            `)
            .bind(user.id)
            .all();

        const chakras = (result.results || []).map(row => ({
            key: row.chakra_key,
            title: row.title,
            sortOrder: Number(row.sort_order),
            pagePath: row.page_path
        }));

        return json({
            authenticated: true,
            fullAccess: false,

            user: {
                id: Number(user.id),
                username: user.username,
                displayName: user.display_name,
                role: user.role,
                accessExpiresAt: user.access_expires_at
            },

            chakras
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

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

        const admin = await currentUser(request, env);

        if (!admin) {
            return json({
                error: "Du bist nicht angemeldet."
            }, 401);
        }

        if (admin.role !== "admin") {
            return json({
                error: "Nur Administratoren dürfen Benutzer verwalten."
            }, 403);
        }

        const userResult = await env.DB
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
                WHERE role = 'user'
                ORDER BY
                    display_name COLLATE NOCASE ASC,
                    username COLLATE NOCASE ASC
            `)
            .all();

        const chakraResult = await env.DB
            .prepare(`
                SELECT
                    uc.user_id,
                    c.chakra_key,
                    c.title,
                    c.sort_order
                FROM user_chakras uc
                INNER JOIN chakras c
                    ON c.id = uc.chakra_id
                WHERE c.is_active = 1
                ORDER BY
                    uc.user_id ASC,
                    c.sort_order ASC
            `)
            .all();

        const usageResult = await env.DB
            .prepare(`
                SELECT
                    pv.user_id,
                    pv.chakra_key,
                    COALESCE(c.title, pv.chakra_key) AS title,
                    SUM(pv.duration_seconds) AS duration_seconds,
                    MAX(
                        COALESCE(
                            pv.ended_at,
                            pv.last_heartbeat_at,
                            pv.started_at
                        )
                    ) AS last_visited_at
                FROM page_visits pv
                LEFT JOIN chakras c
                    ON c.chakra_key = pv.chakra_key
                GROUP BY
                    pv.user_id,
                    pv.chakra_key,
                    c.title
                ORDER BY
                    pv.user_id ASC,
                    duration_seconds DESC
            `)
            .all();

        const users = userResult.results || [];
        const chakraRows = chakraResult.results || [];
        const usageRows = usageResult.results || [];

        const chakrasByUser = new Map();
        const usageByUser = new Map();

        for (const row of chakraRows) {
            const userId = Number(row.user_id);

            if (!chakrasByUser.has(userId)) {
                chakrasByUser.set(userId, []);
            }

            chakrasByUser.get(userId).push(row.chakra_key);
        }

        for (const row of usageRows) {
            const userId = Number(row.user_id);

            if (!usageByUser.has(userId)) {
                usageByUser.set(userId, []);
            }

            usageByUser.get(userId).push({
                chakraKey: row.chakra_key,
                title: row.title,
                durationSeconds: Number(row.duration_seconds) || 0,
                lastVisitedAt: row.last_visited_at || null
            });
        }

        const formattedUsers = users.map(user => {
            const userId = Number(user.id);

            let daysRemaining = null;

            if (user.access_expires_at) {
                const expirationTime = new Date(
                    user.access_expires_at
                ).getTime();

                if (!Number.isNaN(expirationTime)) {
                    daysRemaining = Math.ceil(
                        (expirationTime - Date.now()) / 86400000
                    );
                }
            }

            return {
                id: userId,
                username: user.username,
                email: user.email || "",
                displayName: user.display_name,
                role: user.role,
                isActive: Boolean(user.is_active),
                accessExpiresAt: user.access_expires_at || null,
                lastLoginAt: user.last_login_at || null,
                createdAt: user.created_at || null,
                updatedAt: user.updated_at || null,
                daysRemaining,
                chakras: chakrasByUser.get(userId) || [],
                usage: usageByUser.get(userId) || []
            };
        });

        return json({
            success: true,
            users: formattedUsers
        });
    } catch (error) {
        console.error("Fehler beim Laden der Benutzer:", error);

        return json({
            error: "Die Benutzer konnten nicht geladen werden.",
            details: error instanceof Error
                ? error.message
                : String(error)
        }, 500);
    }
}

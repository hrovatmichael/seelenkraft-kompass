import {
    json,
    currentUser
} from "../auth/_helpers.js";

export async function onRequestGet({ request, env }) {
    try {
        const user = await currentUser(request, env);

        if (!user) {
            return json({
                authenticated: false,
                error: "Du bist nicht angemeldet."
            }, 401);
        }

        const usageResult = await env.DB
            .prepare(`
                SELECT
                    pv.chakra_key,
                    COALESCE(
                        c.title,
                        pv.chakra_key
                    ) AS title,
                    SUM(pv.duration_seconds) AS duration_seconds,
                    COUNT(pv.id) AS visit_count,
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

                WHERE pv.user_id = ?

                GROUP BY
                    pv.chakra_key,
                    c.title,
                    c.sort_order

                ORDER BY
                    c.sort_order ASC
            `)
            .bind(user.id)
            .all();

        const usage = (
            usageResult.results || []
        ).map(row => ({
            chakraKey: row.chakra_key,
            title: row.title,
            durationSeconds:
                Number(row.duration_seconds) || 0,
            visitCount:
                Number(row.visit_count) || 0,
            lastVisitedAt:
                row.last_visited_at || null
        }));

        const totalDurationSeconds =
            usage.reduce(
                (sum, item) => {
                    return (
                        sum +
                        item.durationSeconds
                    );
                },
                0
            );

        let remainingDays = null;

        if (
            user.role !== "admin" &&
            user.access_expires_at
        ) {
            remainingDays = Math.ceil(
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
            authenticated: true,

            user: {
                id: Number(user.id),
                username: user.username,
                displayName:
                    user.display_name,
                email:
                    user.email || "",
                role:
                    user.role,
                createdAt:
                    user.created_at || null,
                firstLoginAt:
                    user.first_login_at || null,
                lastLoginAt:
                    user.last_login_at || null,
                accessExpiresAt:
                    user.access_expires_at || null,
                remainingDays,
                totalDurationSeconds
            },

            usage
        });
    } catch (error) {
        return json({
            error:
                "Die Kontodaten konnten nicht geladen werden.",

            details:
                error instanceof Error
                    ? error.message
                    : String(error)
        }, 500);
    }
}

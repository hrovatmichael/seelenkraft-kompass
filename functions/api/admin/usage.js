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
                error: "Nur Administratoren dürfen Nutzungsdaten abrufen."
            }, 403);
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
                    role,
                    last_login_at
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
                error: "Für den Administrator werden hier keine Chakra-Nutzungszeiten ausgewertet."
            }, 403);
        }

        const usageResult = await env.DB
            .prepare(`
                SELECT
                    pv.chakra_key,
                    COALESCE(
                        c.title,
                        pv.chakra_key
                    ) AS title,
                    SUM(
                        CASE
                            WHEN pv.duration_seconds > 0
                                THEN pv.duration_seconds
                            ELSE 0
                        END
                    ) AS duration_seconds,
                    COUNT(pv.id) AS visit_count,
                    MIN(pv.started_at) AS first_visited_at,
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
                    c.sort_order ASC,
                    pv.chakra_key ASC
            `)
            .bind(userId)
            .all();

        const usageRows = usageResult.results || [];

        const usage = usageRows.map(row => {
            const durationSeconds = Number(
                row.duration_seconds
            ) || 0;

            return {
                chakraKey: row.chakra_key,
                title: row.title,
                durationSeconds,
                durationMinutes: Math.floor(
                    durationSeconds / 60
                ),
                visitCount: Number(
                    row.visit_count
                ) || 0,
                firstVisitedAt:
                    row.first_visited_at || null,
                lastVisitedAt:
                    row.last_visited_at || null
            };
        });

        const totalDurationSeconds = usage.reduce(
            (sum, item) => {
                return sum + item.durationSeconds;
            },
            0
        );

        const totalVisitCount = usage.reduce(
            (sum, item) => {
                return sum + item.visitCount;
            },
            0
        );

        return json({
            success: true,

            user: {
                id: Number(user.id),
                username: user.username,
                displayName: user.display_name,
                lastLoginAt:
                    user.last_login_at || null
            },

            summary: {
                totalDurationSeconds,
                totalDurationMinutes: Math.floor(
                    totalDurationSeconds / 60
                ),
                totalVisitCount,
                visitedChakraCount: usage.length
            },

            usage
        });
    } catch (error) {
        console.error(
            "Fehler beim Laden der Nutzungsdaten:",
            error
        );

        return json({
            error: "Die Nutzungsdaten konnten nicht geladen werden.",
            details: error instanceof Error
                ? error.message
                : String(error)
        }, 500);
    }
}

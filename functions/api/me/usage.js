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

const VALID_ACTIONS = new Set([
    "start",
    "heartbeat",
    "end"
]);

export async function onRequestPost({ request, env }) {
    try {
        if (!env.DB) {
            return json({
                error: "Die D1-Datenbank ist nicht als DB verbunden."
            }, 500);
        }

        const user = await currentUser(request, env);

        if (!user) {
            return json({
                error: "Du bist nicht angemeldet."
            }, 401);
        }

        if (!user.is_active) {
            return json({
                error: "Dieser Benutzerzugang ist deaktiviert."
            }, 403);
        }

        /*
         * Für normale Benutzer wird zusätzlich geprüft,
         * ob die Gültigkeitsdauer abgelaufen ist.
         *
         * Der Administrator besitzt zeitlich unbegrenzten
         * Vollzugriff.
         */
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

        let body;

        try {
            body = await request.json();
        } catch {
            return json({
                error: "Die übermittelten Daten sind ungültig."
            }, 400);
        }

        const action = String(
            body.action || ""
        ).trim();

        const chakraKey = String(
            body.chakraKey || ""
        ).trim();

        const visitId = Number(
            body.visitId
        );

        if (!VALID_ACTIONS.has(action)) {
            return json({
                error: "Die angeforderte Tracking-Aktion ist ungültig."
            }, 400);
        }

        if (!VALID_CHAKRAS.has(chakraKey)) {
            return json({
                error: "Die angegebene Chakra-Seite ist ungültig."
            }, 400);
        }

        const chakra = await env.DB
            .prepare(`
                SELECT
                    id,
                    chakra_key,
                    title,
                    page_path,
                    is_active
                FROM chakras
                WHERE chakra_key = ?
                  AND is_active = 1
                LIMIT 1
            `)
            .bind(chakraKey)
            .first();

        if (!chakra) {
            return json({
                error: "Die Chakra-Seite wurde nicht gefunden."
            }, 404);
        }

        /*
         * Der Administrator darf jede Chakra-Seite öffnen.
         * Bei normalen Benutzern wird die persönliche
         * Freigabe in user_chakras geprüft.
         */
        if (user.role !== "admin") {
            const permission = await env.DB
                .prepare(`
                    SELECT
                        uc.user_id
                    FROM user_chakras uc
                    INNER JOIN chakras c
                        ON c.id = uc.chakra_id
                    WHERE uc.user_id = ?
                      AND c.chakra_key = ?
                      AND c.is_active = 1
                    LIMIT 1
                `)
                .bind(
                    user.id,
                    chakraKey
                )
                .first();

            if (!permission) {
                return json({
                    error: "Diese Chakra-Seite ist für deinen Zugang nicht freigeschaltet."
                }, 403);
            }
        }

        if (action === "start") {
            return startVisit(
                env,
                user,
                chakra
            );
        }

        if (
            !Number.isInteger(visitId) ||
            visitId <= 0
        ) {
            return json({
                error: "Die Besuchs-ID ist ungültig."
            }, 400);
        }

        const visit = await env.DB
            .prepare(`
                SELECT
                    id,
                    user_id,
                    chakra_key,
                    started_at,
                    last_heartbeat_at,
                    ended_at,
                    duration_seconds
                FROM page_visits
                WHERE id = ?
                  AND user_id = ?
                  AND chakra_key = ?
                LIMIT 1
            `)
            .bind(
                visitId,
                user.id,
                chakraKey
            )
            .first();

        if (!visit) {
            return json({
                error: "Der Seitenbesuch wurde nicht gefunden."
            }, 404);
        }

        if (action === "heartbeat") {
            return updateHeartbeat(
                env,
                visit
            );
        }

        if (action === "end") {
            return endVisit(
                env,
                visit
            );
        }

        return json({
            error: "Die Tracking-Aktion konnte nicht verarbeitet werden."
        }, 400);
    } catch (error) {
        console.error(
            "Fehler beim Aufzeichnen des Seitenbesuchs:",
            error
        );

        return json({
            error: "Der Seitenbesuch konnte nicht aufgezeichnet werden.",
            details: error instanceof Error
                ? error.message
                : String(error)
        }, 500);
    }
}

async function startVisit(env, user, chakra) {
    /*
     * Noch offene ältere Besuche derselben Chakra-Seite
     * werden beendet, bevor ein neuer Besuch startet.
     */
    await env.DB
        .prepare(`
            UPDATE page_visits
            SET
                ended_at = CURRENT_TIMESTAMP,
                duration_seconds =
                    duration_seconds +
                    MIN(
                        60,
                        MAX(
                            0,
                            CAST(
                                strftime('%s', 'now') -
                                strftime(
                                    '%s',
                                    last_heartbeat_at
                                )
                                AS INTEGER
                            )
                        )
                    )
            WHERE user_id = ?
              AND chakra_key = ?
              AND ended_at IS NULL
        `)
        .bind(
            user.id,
            chakra.chakra_key
        )
        .run();

    const result = await env.DB
        .prepare(`
            INSERT INTO page_visits (
                user_id,
                chakra_key,
                started_at,
                last_heartbeat_at,
                ended_at,
                duration_seconds
            )
            VALUES (
                ?,
                ?,
                CURRENT_TIMESTAMP,
                CURRENT_TIMESTAMP,
                NULL,
                0
            )
        `)
        .bind(
            user.id,
            chakra.chakra_key
        )
        .run();

    const visitId = Number(
        result.meta?.last_row_id
    );

    if (!visitId) {
        return json({
            error: "Der Seitenbesuch konnte nicht gestartet werden."
        }, 500);
    }

    return json({
        success: true,
        action: "start",
        visitId,
        chakra: {
            key: chakra.chakra_key,
            title: chakra.title
        }
    }, 201);
}

async function updateHeartbeat(env, visit) {
    if (visit.ended_at) {
        return json({
            success: true,
            action: "heartbeat",
            visitId: Number(visit.id),
            ended: true,
            durationSeconds:
                Number(visit.duration_seconds) || 0
        });
    }

    /*
     * Pro Heartbeat werden höchstens 60 Sekunden ergänzt.
     * Dadurch führen lange Pausen, ein eingefrorener Tab
     * oder eine unterbrochene Verbindung nicht zu einer
     * unrealistisch hohen Nutzungsdauer.
     */
    await env.DB
        .prepare(`
            UPDATE page_visits
            SET
                duration_seconds =
                    duration_seconds +
                    MIN(
                        60,
                        MAX(
                            0,
                            CAST(
                                strftime('%s', 'now') -
                                strftime(
                                    '%s',
                                    last_heartbeat_at
                                )
                                AS INTEGER
                            )
                        )
                    ),
                last_heartbeat_at =
                    CURRENT_TIMESTAMP
            WHERE id = ?
              AND ended_at IS NULL
        `)
        .bind(visit.id)
        .run();

    const updatedVisit = await env.DB
        .prepare(`
            SELECT
                id,
                duration_seconds,
                last_heartbeat_at,
                ended_at
            FROM page_visits
            WHERE id = ?
            LIMIT 1
        `)
        .bind(visit.id)
        .first();

    return json({
        success: true,
        action: "heartbeat",
        visitId: Number(updatedVisit.id),
        durationSeconds:
            Number(updatedVisit.duration_seconds) || 0,
        lastHeartbeatAt:
            updatedVisit.last_heartbeat_at || null,
        ended: Boolean(updatedVisit.ended_at)
    });
}

async function endVisit(env, visit) {
    if (!visit.ended_at) {
        await env.DB
            .prepare(`
                UPDATE page_visits
                SET
                    duration_seconds =
                        duration_seconds +
                        MIN(
                            60,
                            MAX(
                                0,
                                CAST(
                                    strftime('%s', 'now') -
                                    strftime(
                                        '%s',
                                        last_heartbeat_at
                                    )
                                    AS INTEGER
                                )
                            )
                        ),
                    last_heartbeat_at =
                        CURRENT_TIMESTAMP,
                    ended_at =
                        CURRENT_TIMESTAMP
                WHERE id = ?
                  AND ended_at IS NULL
            `)
            .bind(visit.id)
            .run();
    }

    const endedVisit = await env.DB
        .prepare(`
            SELECT
                id,
                started_at,
                last_heartbeat_at,
                ended_at,
                duration_seconds
            FROM page_visits
            WHERE id = ?
            LIMIT 1
        `)
        .bind(visit.id)
        .first();

    return json({
        success: true,
        action: "end",
        visitId: Number(endedVisit.id),
        startedAt:
            endedVisit.started_at || null,
        endedAt:
            endedVisit.ended_at || null,
        durationSeconds:
            Number(endedVisit.duration_seconds) || 0
    });
}

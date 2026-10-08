import {
    json,
    currentUser
} from "../auth/_helpers.js";

export async function onRequestDelete({ request, env }) {
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
                error: "Nur Administratoren dürfen Benutzer löschen."
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

        if (!Number.isInteger(userId) || userId <= 0) {
            return json({
                error: "Die Benutzer-ID ist ungültig."
            }, 400);
        }

        if (userId === Number(admin.id)) {
            return json({
                error: "Das eigene Administratorkonto kann nicht gelöscht werden."
            }, 403);
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
                error: "Administratorkonten können nicht über die Benutzerverwaltung gelöscht werden."
            }, 403);
        }

        /*
         * Die Tabellen sessions, user_chakras und page_visits
         * besitzen ON DELETE CASCADE.
         *
         * Beim Löschen des Benutzers werden damit automatisch
         * alle Sitzungen, Chakra-Freigaben und Nutzungsdaten
         * dieses Benutzers entfernt.
         */
        const deleteResult = await env.DB
            .prepare(`
                DELETE FROM users
                WHERE id = ?
                  AND role = 'user'
            `)
            .bind(userId)
            .run();

        const deletedRows = Number(
            deleteResult.meta?.changes || 0
        );

        if (deletedRows === 0) {
            return json({
                error: "Der Benutzer konnte nicht gelöscht werden."
            }, 500);
        }

        return json({
            success: true,
            message: "Der Benutzer wurde erfolgreich gelöscht.",
            deletedUser: {
                id: Number(user.id),
                username: user.username,
                displayName: user.display_name
            }
        });
    } catch (error) {
        console.error(
            "Fehler beim Löschen des Benutzers:",
            error
        );

        return json({
            error: "Der Benutzer konnte nicht gelöscht werden.",
            details: error instanceof Error
                ? error.message
                : String(error)
        }, 500);
    }
}

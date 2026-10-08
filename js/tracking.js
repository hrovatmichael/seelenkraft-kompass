"use strict";

(() => {
    const HEARTBEAT_INTERVAL = 30000;

    let visitId = null;
    let heartbeatTimer = null;
    let requestRunning = false;
    let visitEnded = false;

    const chakraKey = getChakraKey();

    if (!chakraKey) {
        console.warn(
            "Nutzungserfassung wurde nicht gestartet: " +
            "Auf der Seite fehlt data-chakra-key."
        );

        return;
    }

    function getChakraKey() {
        const keyFromBody = document.body.dataset.chakraKey;

        if (keyFromBody) {
            return keyFromBody.trim();
        }

        const keyFromHtml =
            document.documentElement.dataset.chakraKey;

        if (keyFromHtml) {
            return keyFromHtml.trim();
        }

        return null;
    }

    async function sendUsageRequest(action) {
        if (
            requestRunning ||
            visitEnded ||
            (
                action !== "start" &&
                !visitId
            )
        ) {
            return null;
        }

        requestRunning = true;

        try {
            const requestBody = {
                action,
                chakraKey
            };

            if (visitId) {
                requestBody.visitId = visitId;
            }

            const response = await fetch(
                "/api/me/usage",
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    credentials: "same-origin",
                    cache: "no-store",
                    body: JSON.stringify(requestBody)
                }
            );

            const text = await response.text();

            let data = {};

            if (text) {
                try {
                    data = JSON.parse(text);
                } catch {
                    data = {
                        error: text
                    };
                }
            }

            if (!response.ok) {
                throw new Error(
                    data.error ||
                    "Die Nutzungszeit konnte nicht gespeichert werden."
                );
            }

            if (
                action === "start" &&
                data.visitId
            ) {
                visitId = Number(data.visitId);
            }

            if (action === "end") {
                visitEnded = true;
            }

            return data;
        } catch (error) {
            console.error(
                "Fehler bei der Nutzungserfassung:",
                error
            );

            return null;
        } finally {
            requestRunning = false;
        }
    }

    async function startVisit() {
        if (visitId || visitEnded) {
            return;
        }

        const result = await sendUsageRequest("start");

        if (!result?.visitId) {
            return;
        }

        startHeartbeat();
    }

    function startHeartbeat() {
        stopHeartbeat();

        heartbeatTimer = window.setInterval(
            async () => {
                if (
                    document.visibilityState !== "visible" ||
                    !visitId ||
                    visitEnded
                ) {
                    return;
                }

                await sendUsageRequest("heartbeat");
            },
            HEARTBEAT_INTERVAL
        );
    }

    function stopHeartbeat() {
        if (!heartbeatTimer) {
            return;
        }

        window.clearInterval(heartbeatTimer);
        heartbeatTimer = null;
    }

    async function sendImmediateHeartbeat() {
        if (
            document.visibilityState !== "visible" ||
            !visitId ||
            visitEnded
        ) {
            return;
        }

        await sendUsageRequest("heartbeat");
    }

    function endVisit() {
        if (
            !visitId ||
            visitEnded
        ) {
            return;
        }

        visitEnded = true;
        stopHeartbeat();

        const payload = JSON.stringify({
            action: "end",
            chakraKey,
            visitId
        });

        const blob = new Blob(
            [payload],
            {
                type: "application/json"
            }
        );

        const beaconSent = navigator.sendBeacon(
            "/api/me/usage",
            blob
        );

        if (!beaconSent) {
            fetch(
                "/api/me/usage",
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    credentials: "same-origin",
                    keepalive: true,
                    body: payload
                }
            ).catch(error => {
                console.error(
                    "Seitenende konnte nicht gespeichert werden:",
                    error
                );
            });
        }
    }

    document.addEventListener(
        "visibilitychange",
        () => {
            if (
                document.visibilityState === "visible"
            ) {
                sendImmediateHeartbeat();
            }
        }
    );

    window.addEventListener(
        "pagehide",
        endVisit
    );

    window.addEventListener(
        "beforeunload",
        endVisit
    );

    startVisit();
})();

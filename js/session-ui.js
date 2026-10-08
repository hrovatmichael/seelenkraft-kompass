"use strict";

(() => {
    const chakraConfiguration = {
        wurzel: {
            title: "Wurzelchakra",
            pagePath: "/chakra/wurzelchakra.html"
        },
        sakral: {
            title: "Sakralchakra",
            pagePath: "/chakra/sakralchakra.html"
        },
        solar: {
            title: "Solarplexuschakra",
            pagePath: "/chakra/solarplexuschakra.html"
        },
        herz: {
            title: "Herzchakra",
            pagePath: "/chakra/herzchakra.html"
        },
        hals: {
            title: "Halschakra",
            pagePath: "/chakra/halschakra.html"
        },
        stirn: {
            title: "Stirnchakra",
            pagePath: "/chakra/stirnchakra.html"
        },
        krone: {
            title: "Kronenchakra",
            pagePath: "/chakra/kronenchakra.html"
        }
    };

    const chakraKeys = Object.keys(chakraConfiguration);

    document.addEventListener(
        "DOMContentLoaded",
        initializeSessionInterface
    );

    async function initializeSessionInterface() {
        addSessionStyles();

        const sessionData = await loadSession();

        if (!sessionData.authenticated) {
            showGuestInterface();
            return;
        }

        const chakraData = await loadChakras();

        showAuthenticatedInterface(
            sessionData.user,
            chakraData.chakras || []
        );
    }

    async function loadSession() {
        try {
            const response = await fetch(
                "/api/auth/session",
                {
                    method: "GET",
                    credentials: "same-origin",
                    cache: "no-store"
                }
            );

            if (!response.ok) {
                return {
                    authenticated: false
                };
            }

            return await response.json();
        } catch (error) {
            console.error(
                "Session konnte nicht geladen werden:",
                error
            );

            return {
                authenticated: false
            };
        }
    }

    async function loadChakras() {
        try {
            const response = await fetch(
                "/api/me/chakras",
                {
                    method: "GET",
                    credentials: "same-origin",
                    cache: "no-store"
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
                    "Die Chakra-Freigaben konnten nicht geladen werden."
                );
            }

            return data;
        } catch (error) {
            console.error(
                "Chakra-Freigaben konnten nicht geladen werden:",
                error
            );

            return {
                chakras: []
            };
        }
    }

    function showGuestInterface() {
        updateChakraMenu(new Set());

        const topbar = document.querySelector(".topbar");

        if (!topbar) {
            return;
        }

        topbar.innerHTML = "";

        const loginLink = document.createElement("a");

        loginLink.href = "/login.html";
        loginLink.className = "login-link";
        loginLink.textContent = "Anmelden";

        topbar.appendChild(loginLink);
    }

    function showAuthenticatedInterface(
        user,
        grantedChakras
    ) {
        const grantedKeys = new Set(
            grantedChakras.map(chakra => {
                return chakra.key;
            })
        );

        if (user.role === "admin") {
            chakraKeys.forEach(key => {
                grantedKeys.add(key);
            });
        }

        updateChakraMenu(grantedKeys);
        renderStatusBar(user);
    }

    function updateChakraMenu(grantedKeys) {
        const menu = document.querySelector(".menu");

        if (!menu) {
            return;
        }

        chakraKeys.forEach(key => {
            const configuration =
                chakraConfiguration[key];

            const existingItem = findMenuItem(
                menu,
                configuration.title
            );

            if (!existingItem) {
                return;
            }

            if (grantedKeys.has(key)) {
                const link = document.createElement("a");

                link.href = configuration.pagePath;
                link.className = "menu-item";
                link.textContent = configuration.title;
                link.dataset.chakraKey = key;

                existingItem.replaceWith(link);
                return;
            }

            const disabledItem =
                document.createElement("span");

            disabledItem.className =
                "menu-item disabled";

            disabledItem.textContent =
                configuration.title;

            disabledItem.dataset.chakraKey = key;

            disabledItem.setAttribute(
                "aria-disabled",
                "true"
            );

            existingItem.replaceWith(disabledItem);
        });
    }

    function findMenuItem(menu, title) {
        const normalizedTitle =
            normalizeText(title);

        return [
            ...menu.querySelectorAll(".menu-item")
        ].find(item => {
            const itemText = normalizeText(
                item.textContent
            );

            return itemText === normalizedTitle;
        });
    }

    function renderStatusBar(user) {
        const topbar = document.querySelector(".topbar");

        if (!topbar) {
            return;
        }

        topbar.innerHTML = "";

        const statusbar =
            document.createElement("div");

        statusbar.className = "user-statusbar";

        const textArea =
            document.createElement("div");

        textArea.className =
            "user-statusbar-text";

        const loggedInText =
            document.createElement("strong");

        const displayName =
            user.displayName ||
            user.username ||
            "Benutzer";

        loggedInText.textContent =
            `Angemeldet als ${displayName}`;

        const validityText =
            document.createElement("span");

        const daysRemaining =
            user.role === "admin"
                ? null
                : calculateDaysRemaining(
                    user.accessExpiresAt
                );

        validityText.textContent =
            user.role === "admin"
                ? "Vollzugriff auf alle Chakra-Seiten"
                : formatValidityText(
                    user.accessExpiresAt,
                    daysRemaining
                );

        textArea.append(
            loggedInText,
            validityText
        );

        const actions =
            document.createElement("div");

        actions.className =
            "user-statusbar-actions";

        if (user.role === "admin") {
            const adminLink =
                document.createElement("a");

            adminLink.href =
                "/admin/benutzer.html";

            adminLink.className =
                "statusbar-button secondary";

            adminLink.textContent =
                "Adminbereich";

            actions.appendChild(adminLink);
        }

        const showRenewButton =
            user.role !== "admin" &&
            daysRemaining !== null &&
            daysRemaining <= 7;

        if (showRenewButton) {
            const renewButton =
                document.createElement("a");

            renewButton.href =
                "/zugang-verlaengern.html";

            renewButton.className =
                "statusbar-button renew";

            renewButton.textContent =
                "Zugang verlängern";

            actions.appendChild(renewButton);
        }

        const logoutButton =
            document.createElement("button");

        logoutButton.id =
            "sessionLogoutButton";

        logoutButton.type = "button";

        logoutButton.className =
            "statusbar-button logout";

        logoutButton.textContent =
            "Abmelden";

        logoutButton.addEventListener(
            "click",
            logout
        );

        actions.appendChild(logoutButton);

        statusbar.append(
            textArea,
            actions
        );

        topbar.appendChild(statusbar);
    }

    function calculateDaysRemaining(value) {
        if (!value) {
            return null;
        }

        const expirationDate =
            new Date(value);

        if (
            Number.isNaN(
                expirationDate.getTime()
            )
        ) {
            return null;
        }

        return Math.ceil(
            (
                expirationDate.getTime() -
                Date.now()
            ) / 86400000
        );
    }

    function formatValidityText(
        accessExpiresAt,
        daysRemaining
    ) {
        if (!accessExpiresAt) {
            return "Keine Gültigkeitsdauer hinterlegt";
        }

        const expirationDate =
            new Date(accessExpiresAt);

        if (
            Number.isNaN(
                expirationDate.getTime()
            )
        ) {
            return "Gültigkeitsdatum ist ungültig";
        }

        const formattedDate =
            new Intl.DateTimeFormat(
                "de-AT",
                {
                    dateStyle: "medium"
                }
            ).format(expirationDate);

        if (
            daysRemaining !== null &&
            daysRemaining < 0
        ) {
            return `Zugang abgelaufen am ${formattedDate}`;
        }

        if (daysRemaining === 0) {
            return "Zugang läuft heute ab";
        }

        if (daysRemaining === 1) {
            return `Gültig bis ${formattedDate} · noch 1 Tag`;
        }

        if (daysRemaining === null) {
            return `Gültig bis ${formattedDate}`;
        }

        return `Gültig bis ${formattedDate} · noch ${daysRemaining} Tage`;
    }

    async function logout() {
        try {
            await fetch(
                "/api/auth/logout",
                {
                    method: "POST",
                    credentials: "same-origin",
                    cache: "no-store"
                }
            );
        } catch (error) {
            console.error(
                "Abmelden fehlgeschlagen:",
                error
            );
        } finally {
            location.href = "/index.html";
        }
    }

    function normalizeText(value) {
        return String(value || "")
            .trim()
            .toLocaleLowerCase("de-AT");
    }

    function addSessionStyles() {
        if (
            document.getElementById(
                "sessionInterfaceStyles"
            )
        ) {
            return;
        }

        const style =
            document.createElement("style");

        style.id =
            "sessionInterfaceStyles";

        style.textContent = `
            .topbar {
                width: 100%;
            }

            .login-link {
                display: inline-flex;
                align-items: center;
                justify-content: center;
                color: #27352f;
                font-size: 14px;
                font-weight: 700;
                text-decoration: none;
            }

            .login-link:hover {
                color: #4f7064;
            }

            .user-statusbar {
                display: flex;
                justify-content: space-between;
                gap: 18px;
                align-items: center;
                width: 100%;
                padding: 13px 16px;
                background: rgba(
                    255,
                    253,
                    249,
                    0.96
                );
                border: 1px solid #e2ddd4;
                border-radius: 15px;
            }

            .user-statusbar-text {
                display: grid;
                gap: 3px;
                color: #27352f;
            }

            .user-statusbar-text strong {
                font-size: 14px;
            }

            .user-statusbar-text span {
                color: #82786f;
                font-size: 13px;
            }

            .user-statusbar-actions {
                display: flex;
                flex-wrap: wrap;
                gap: 8px;
                justify-content: flex-end;
            }

            .statusbar-button {
                display: inline-flex;
                align-items: center;
                justify-content: center;
                min-height: 38px;
                padding: 8px 14px;
                border-radius: 999px;
                font-family: inherit;
                font-size: 13px;
                font-weight: 700;
                text-decoration: none;
                cursor: pointer;
            }

            .statusbar-button.secondary {
                border: 1px solid #4f7064;
                background: #ffffff;
                color: #4f7064;
            }

            .statusbar-button.renew {
                border: 1px solid #b1844f;
                background: #b1844f;
                color: #ffffff;
            }

            .statusbar-button.logout {
                border: 1px solid #e2ddd4;
                background: transparent;
                color: #27352f;
            }

            @media (max-width: 720px) {
                .user-statusbar {
                    align-items: stretch;
                    flex-direction: column;
                }

                .user-statusbar-actions {
                    justify-content: stretch;
                }

                .statusbar-button {
                    flex: 1 1 auto;
                }
            }
        `;

        document.head.appendChild(style);
    }
})();

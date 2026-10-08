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

        const session = await loadSession();

        if (!session?.authenticated) {
            showGuestInterface();
            return;
        }

        const chakraData = await loadChakras();

        showAuthenticatedInterface(
            session.user,
            chakraData?.chakras || []
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

            const data = await response.json();

            if (!response.ok) {
                throw new Error(
                    data.error ||
                    "Chakra-Freigaben konnten nicht geladen werden."
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
        disableAllChakraMenuItems();

        const topbar = document.querySelector(".topbar");

        if (!topbar) {
            return;
        }

        topbar.innerHTML = `
            /login.html
                Anmelden
            </a>
        `;
    }

    function showAuthenticatedInterface(
        user,
        grantedChakras
    ) {
        const grantedKeys = new Set(
            grantedChakras.map(chakra => chakra.key)
        );

        activateChakraMenuItems(grantedKeys);
        renderStatusBar(user);
    }

    function disableAllChakraMenuItems() {
        const menu = document.querySelector(".menu");

        if (!menu) {
            return;
        }

        const chakraItems = [
            ...menu.querySelectorAll(".menu-item")
        ].filter(item => {
            return chakraKeys.some(key => {
                return normalizeText(item.textContent).includes(
                    normalizeText(
                        chakraConfiguration[key].title
                    )
                );
            });
        });

        chakraItems.forEach(item => {
            const replacement = document.createElement("span");

            replacement.className = "menu-item disabled";
            replacement.textContent = item.textContent.trim();
            replacement.setAttribute(
                "aria-disabled",
                "true"
            );

            item.replaceWith(replacement);
        });
    }

    function activateChakraMenuItems(grantedKeys) {
        const menu = document.querySelector(".menu");

        if (!menu) {
            return;
        }

        const menuItems = [
            ...menu.querySelectorAll(".menu-item")
        ];

        chakraKeys.forEach(key => {
            const configuration =
                chakraConfiguration[key];

            const currentItem = menuItems.find(item => {
                return normalizeText(
                    item.textContent
                ).includes(
                    normalizeText(configuration.title)
                );
            });

            if (!currentItem) {
                return;
            }

            if (!grantedKeys.has(key)) {
                const disabledItem =
                    document.createElement("span");

                disabledItem.className =
                    "menu-item disabled";

                disabledItem.textContent =
                    configuration.title;

                disabledItem.setAttribute(
                    "aria-disabled",
                    "true"
                );

                currentItem.replaceWith(disabledItem);
                return;
            }

            const activeLink =
                document.createElement("a");

            activeLink.className = "menu-item";
            activeLink.href = configuration.pagePath;
            activeLink.textContent = configuration.title;

            currentItem.replaceWith(activeLink);
        });
    }

    function renderStatusBar(user) {
        const topbar = document.querySelector(".topbar");

        if (!topbar) {
            return;
        }

        const displayName =
            user.displayName ||
            user.username ||
            "Benutzer";

        const daysRemaining =
            user.role === "admin"
                ? null
                : calculateDaysRemaining(
                    user.accessExpiresAt
                );

        const validityText =
            user.role === "admin"
                ? "Vollzugriff"
                : formatValidityText(
                    user.accessExpiresAt,
                    daysRemaining
                );

        const showRenewButton =
            user.role !== "admin" &&
            daysRemaining !== null &&
            daysRemaining <= 7;

        topbar.innerHTML = `
            <div class="user-statusbar">

                <div class="user-statusbar-text">

                    <strong>
                        Angemeldet als ${escapeHtml(displayName)}
                    </strong>

                    <span>
                        ${escapeHtml(validityText)}
                    </span>

                </div>

                <div class="user-statusbar-actions">

                    ${
                        user.role === "admin"
                            ? `
                                /admin/benutzer.html
                                    Adminbereich
                                </a>
                            `
                            : ""
                    }

                    ${
                        showRenewButton
                            ? `
                                /zugang-verlaengern.html
                                    Zugang verlängern
                                </a>
                            `
                            : ""
                    }

                    <button
                        id="sessionLogoutButton"
                        class="statusbar-button logout"
                        type="button"
                    >
                        Abmelden
                    </button>

                </div>

            </div>
        `;

        document
            .getElementById("sessionLogoutButton")
            ?.addEventListener(
                "click",
                logout
            );
    }

    function calculateDaysRemaining(value) {
        if (!value) {
            return null;
        }

        const expirationDate = new Date(value);

        if (Number.isNaN(expirationDate.getTime())) {
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

        const expirationDate = new Date(
            accessExpiresAt
        );

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
            return `Zugang läuft heute ab`;
        }

        if (daysRemaining === 1) {
            return `Gültig bis ${formattedDate} · noch 1 Tag`;
        }

        return daysRemaining === null
            ? `Gültig bis ${formattedDate}`
            : `Gültig bis ${formattedDate} · noch ${daysRemaining} Tage`;
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
        } finally {
            location.href = "/index.html";
        }
    }

    function normalizeText(value) {
        return String(value || "")
            .trim()
            .toLocaleLowerCase("de-AT");
    }

    function escapeHtml(value) {
        return String(value || "")
            .replaceAll("&", "&amp;")
            .replaceAll("<", "&lt;")
            .replaceAll(">", "&gt;")
            .replaceAll('"', "&quot;")
            .replaceAll("'", "&#039;");
    }

    function addSessionStyles() {
        if (
            document.getElementById(
                "sessionInterfaceStyles"
            )
        ) {
            return;
        }

        const style = document.createElement("style");

        style.id = "sessionInterfaceStyles";

        style.textContent = `
            .topbar {
                width: 100%;
            }

            .user-statusbar {
                display: flex;
                justify-content: space-between;
                gap: 18px;
                align-items: center;
                width: 100%;
                padding: 13px 16px;
                background: rgba(255, 253, 249, 0.96);
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

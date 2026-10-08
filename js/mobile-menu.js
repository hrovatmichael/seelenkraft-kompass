"use strict";

document.addEventListener("DOMContentLoaded", () => {
    const sidebar = document.querySelector(".sidebar");
    const logo = document.querySelector(".sidebar .logo");
    const menu = document.querySelector(".sidebar .menu");

    if (!sidebar || !logo || !menu) {
        console.error(
            "Mobiles Menü konnte nicht aufgebaut werden.",
            {
                sidebarGefunden: Boolean(sidebar),
                logoGefunden: Boolean(logo),
                menuGefunden: Boolean(menu)
            }
        );

        return;
    }

    /*
     * Das vorhandene Logo wird am Handy zum Menüknopf.
     */
    logo.innerHTML = "";

    const brandText = document.createElement("span");
    brandText.className = "mobile-brand-text";
    brandText.textContent = "Seelenkraft-Kompass";

    const menuDots = document.createElement("span");
    menuDots.className = "mobile-menu-dots";
    menuDots.textContent = "⋮";
    menuDots.setAttribute("aria-hidden", "true");

    logo.append(
        brandText,
        menuDots
    );

    logo.setAttribute("role", "button");
    logo.setAttribute("tabindex", "0");
    logo.setAttribute("aria-label", "Menü öffnen");
    logo.setAttribute("aria-expanded", "false");
    logo.setAttribute("aria-controls", "mobileMainMenu");

    menu.id = "mobileMainMenu";

    function menuOeffnenOderSchliessen() {
        if (window.innerWidth > 760) {
            return;
        }

        const istGeoeffnet = sidebar.classList.toggle(
            "mobile-menu-open"
        );

        logo.setAttribute(
            "aria-expanded",
            String(istGeoeffnet)
        );

        logo.setAttribute(
            "aria-label",
            istGeoeffnet
                ? "Menü schließen"
                : "Menü öffnen"
        );

        menuDots.textContent = istGeoeffnet
            ? "×"
            : "⋮";
    }

    function menuSchliessen() {
        sidebar.classList.remove(
            "mobile-menu-open"
        );

        logo.setAttribute(
            "aria-expanded",
            "false"
        );

        logo.setAttribute(
            "aria-label",
            "Menü öffnen"
        );

        menuDots.textContent = "⋮";
    }

    logo.addEventListener(
        "click",
        menuOeffnenOderSchliessen
    );

    logo.addEventListener(
        "keydown",
        event => {
            if (
                event.key === "Enter" ||
                event.key === " "
            ) {
                event.preventDefault();
                menuOeffnenOderSchliessen();
            }

            if (event.key === "Escape") {
                menuSchliessen();
            }
        }
    );

    menu.addEventListener(
        "click",
        event => {
            if (
                window.innerWidth <= 760 &&
                event.target.closest("a")
            ) {
                menuSchliessen();
            }
        }
    );

    document.addEventListener(
        "click",
        event => {
            if (window.innerWidth > 760) {
                return;
            }

            if (
                sidebar.classList.contains(
                    "mobile-menu-open"
                ) &&
                !sidebar.contains(event.target)
            ) {
                menuSchliessen();
            }
        }
    );

    window.addEventListener(
        "resize",
        () => {
            if (window.innerWidth > 760) {
                menuSchliessen();
            }
        }
    );
});

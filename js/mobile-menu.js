"use strict";

document.addEventListener("DOMContentLoaded", () => {
    const sidebar = document.querySelector(".sidebar");
    const menu = document.querySelector(".menu");

    if (!sidebar || !menu) {
        return;
    }

    const menuButton = document.createElement("button");

    menuButton.id = "mobileMenuButton";
    menuButton.className = "mobile-menu-button";
    menuButton.type = "button";
    menuButton.setAttribute("aria-label", "Menü öffnen");
    menuButton.setAttribute("aria-expanded", "false");
    menuButton.textContent = "⋮";

    sidebar.appendChild(menuButton);

    menuButton.addEventListener("click", () => {
        const menuIsOpen = sidebar.classList.toggle(
            "mobile-menu-open"
        );

        menuButton.setAttribute(
            "aria-expanded",
            String(menuIsOpen)
        );

        menuButton.setAttribute(
            "aria-label",
            menuIsOpen
                ? "Menü schließen"
                : "Menü öffnen"
        );
    });

    menu.addEventListener("click", event => {
        if (
            window.innerWidth <= 760 &&
            event.target.closest("a")
        ) {
            sidebar.classList.remove(
                "mobile-menu-open"
            );

            menuButton.setAttribute(
                "aria-expanded",
                "false"
            );
        }
    });

    document.addEventListener("click", event => {
        if (
            window.innerWidth > 760 ||
            !sidebar.classList.contains(
                "mobile-menu-open"
            )
        ) {
            return;
        }

        if (!sidebar.contains(event.target)) {
            sidebar.classList.remove(
                "mobile-menu-open"
            );

            menuButton.setAttribute(
                "aria-expanded",
                "false"
            );
        }
    });

    window.addEventListener("resize", () => {
        if (window.innerWidth > 760) {
            sidebar.classList.remove(
                "mobile-menu-open"
            );

            menuButton.setAttribute(
                "aria-expanded",
                "false"
            );
        }
    });
});

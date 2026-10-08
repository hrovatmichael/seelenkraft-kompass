"use strict";

const $ = selector =>
    document.querySelector(selector);

function formatDate(value) {
    if (!value) {
        return "Noch nicht vorhanden";
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return "Noch nicht vorhanden";
    }

    return new Intl.DateTimeFormat(
        "de-AT",
        {
            dateStyle: "medium",
            timeStyle: "short"
        }
    ).format(date);
}

function formatDuration(seconds) {
    const total =
        Math.max(
            0,
            Number(seconds) || 0
        );

    const hours =
        Math.floor(total / 3600);

    const minutes =
        Math.floor(
            (total % 3600) / 60
        );

    if (hours > 0) {
        return `${hours} Std. ${minutes} Min.`;
    }

    if (minutes > 0) {
        return `${minutes} Min.`;
    }

    return `${total} Sek.`;
}

async function loadAccount() {
    try {
        const response = await fetch(
            "/api/me/account",
            {
                method: "GET",
                credentials: "same-origin",
                cache: "no-store"
            }
        );

        const data =
            await response.json();

        if (!response.ok) {
            throw new Error(
                data.error ||
                "Kontodaten konnten nicht geladen werden."
            );
        }

        const user = data.user;

        $("#accountDisplayName").textContent =
            user.displayName ||
            "Dein persönlicher Bereich";

        $("#accountUsername").textContent =
            user.username;

        $("#accountEmail").textContent =
            user.email ||
            "Nicht hinterlegt";

        $("#accountCreatedAt").textContent =
            formatDate(
                user.createdAt
            );

        $("#accountFirstLogin").textContent =
            formatDate(
                user.firstLoginAt
            );

        $("#accountLastLogin").textContent =
            formatDate(
                user.lastLoginAt
            );

        $("#accountTotalUsage").textContent =
            formatDuration(
                user.totalDurationSeconds
            );

        if (user.role === "admin") {
            $("#accountAccess").textContent =
                "Vollzugriff";
        } else if (
            user.remainingDays < 0
        ) {
            $("#accountAccess").textContent =
                "Zugang abgelaufen";
        } else if (
            user.remainingDays === 1
        ) {
            $("#accountAccess").textContent =
                "Noch 1 Tag";
        } else {
            $("#accountAccess").textContent =
                `Noch ${user.remainingDays} Tage`;
        }

        $("#accountRenewLink").hidden =
            user.role === "admin" ||
            user.remainingDays === null ||
            user.remainingDays > 7;

        renderUsage(data.usage || []);
    } catch (error) {
        $("#accountMessage").textContent =
            error.message;

        window.setTimeout(() => {
            location.href = "/login.html";
        }, 1000);
    }
}

function renderUsage(usage) {
    const list =
        $("#accountUsageList");

    list.innerHTML = "";

    if (!usage.length) {
        list.innerHTML = `
            <p class="empty-message">
                Noch keine Nutzungsdaten vorhanden.
            </p>
        `;

        return;
    }

    usage.forEach(item => {
        const row =
            document.createElement("div");

        row.className = "usage-row";

        const information =
            document.createElement("div");

        const title =
            document.createElement("strong");

        title.textContent =
            item.title;

        const visits =
            document.createElement("span");

        visits.textContent =
            `${item.visitCount} Aufruf${
                item.visitCount === 1
                    ? ""
                    : "e"
            }`;

        information.append(
            title,
            visits
        );

        const duration =
            document.createElement("strong");

        duration.textContent =
            formatDuration(
                item.durationSeconds
            );

        row.append(
            information,
            duration
        );

        list.appendChild(row);
    });
}

$("#accountLogoutButton")
    .addEventListener(
        "click",
        async () => {
            await fetch(
                "/api/auth/logout",
                {
                    method: "POST",
                    credentials: "same-origin"
                }
            );

            location.href = "/index.html";
        }
    );

loadAccount();

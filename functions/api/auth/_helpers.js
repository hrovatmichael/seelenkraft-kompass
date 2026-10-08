const encoder = new TextEncoder();

export function json(data, status = 200, headers = {}) {
    return new Response(JSON.stringify(data), {
        status,
        headers: {
            "Content-Type": "application/json; charset=utf-8",
            "Cache-Control": "no-store",
            ...headers
        }
    });
}

export function cookie(request, name) {
    const cookieHeader = request.headers.get("Cookie") || "";

    for (const part of cookieHeader.split(";")) {
        const [key, ...valueParts] = part.trim().split("=");

        if (key === name) {
            return decodeURIComponent(valueParts.join("="));
        }
    }

    return null;
}

export function hex(buffer) {
    return [...new Uint8Array(buffer)]
        .map(value => value.toString(16).padStart(2, "0"))
        .join("");
}

export function randomHex(length = 32) {
    const value = new Uint8Array(length);
    crypto.getRandomValues(value);

    return hex(value);
}

export async function hashPassword(password, saltHex) {
    const saltParts = saltHex.match(/.{2}/g);

    if (!saltParts) {
        throw new Error("Ungültiger Passwort-Salt.");
    }

    const salt = new Uint8Array(
        saltParts.map(value => parseInt(value, 16))
    );

    const passwordKey = await crypto.subtle.importKey(
        "raw",
        encoder.encode(password),
        {
            name: "PBKDF2"
        },
        false,
        [
            "deriveBits"
        ]
    );

    const derivedBits = await crypto.subtle.deriveBits(
        {
            name: "PBKDF2",
            salt,
            iterations: 100000,
            hash: "SHA-256"
        },
        passwordKey,
        256
    );

    return hex(derivedBits);
}

export function safeEqual(firstValue, secondValue) {
    if (
        typeof firstValue !== "string" ||
        typeof secondValue !== "string" ||
        firstValue.length !== secondValue.length
    ) {
        return false;
    }

    let difference = 0;

    for (let index = 0; index < firstValue.length; index += 1) {
        difference |= (
            firstValue.charCodeAt(index) ^
            secondValue.charCodeAt(index)
        );
    }

    return difference === 0;
}

export async function currentUser(request, env) {
    const sessionId = cookie(request, "sk_session");

    if (!sessionId) {
        return null;
    }

    return env.DB
        .prepare(`
            SELECT
                u.*,
                s.expires_at AS session_expires_at
            FROM sessions s
            JOIN users u
                ON u.id = s.user_id
            WHERE s.id = ?
              AND s.expires_at > datetime('now')
        `)
        .bind(sessionId)
        .first();
}

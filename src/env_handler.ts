// src/env_handler.ts
declare const __ENV__: Record<string, string | undefined>;

function required(key: string): string {
    const val = __ENV__[key];
    if (!val) {
        throw new Error(`Missing required env var: ${key}`);
    }
    return val;
}

function optional(key: string, fallback = ""): string {
    return __ENV__[key] ?? fallback;
}

export const ENV = {
    //HAXBALL_PLATFORM: required("HAXBALL_PLATFORM") as "puppeteer" | "browser" | "node",

    PASSWORDS_ADMIN: optional("PASSWORDS_ADMIN"),
    PASSWORDS_SUPERADMIN: optional("PASSWORDS_SUPERADMIN"),
    PASSWORDS_DEVELOPER: optional("PASSWORDS_DEVELOPER"),

    DISCORD_ROOMSTATUS_URL: optional("DISCORD_ROOMSTATUS_URL"),
    DISCORD_ROOMPASSWORD_URL: optional("DISCORD_ROOMPASSWORD_URL"),
    DISCORD_CHATLOGS_URL: optional("DISCORD_CHATLOGS_URL"),
    DISCORD_ICON_URL: optional("DISCORD_ICON_URL"),
    DISCORD_INVITE_URL: optional("DISCORD_INVITE_URL"),

    SAVED_ADMIN_AUTHS_URL: optional("SAVED_ADMIN_AUTHS_URL"),
    STADIUMS_URL: optional("STADIUMS_URL"),
    KITS_URL: optional("KITS_URL"),

    UI_SESSION_SECRET: optional("UI_SESSION_SECRET"),
    UI_AUTH_USERS: optional("UI_AUTH_USERS"),

    HB_ROOM_NAME: optional("HB_ROOM_NAME"),
    HB_ROOM_GEO: optional("HB_ROOM_GEO"),
    DEV_HB_TOKEN: optional("DEV_HB_TOKEN"),

    DB_API_URL: optional("DB_API_URL"),

    GEMINI_API_KEY: optional("GEMINI_API_KEY"),
} as const;
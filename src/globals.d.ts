declare function HBInit(config: {
    roomName?: string;
    maxPlayers?: number;
    public?: boolean;
    noPlayer?: boolean;
    token?: string;
    [key: string]: any;
}): any;

declare const hjsToken: string;
declare const hjsCallback: function;

// to check if (process.env.NODE_ENV !== "production")
declare const process: {
    env: {
        NODE_ENV: string; // "production" | "development" (no need to write this in .env, it's set by build.js)
        HAXBALL_PLATFORM: string; // "browser" | "puppeteer" | "node" (no need to write this in .env, it's set by build.js)
        DISCORD_ROOMSTATUS_URL: string; // https://discord.com/api/webhooks/[webhookId]/[token]/messages/[messageId]?thread_id=[threadId]
        DISCORD_ROOMPASSWORD_URL: string; // https://discord.com/api/webhooks/[webhookId]/[token]/messages/[messageId]?thread_id=[threadId]
        DISCORD_CHATLOGS_URL: string; // https://discord.com/api/webhooks/[webhookId]/[token]?thread_id=[threadId]
        DISCORD_ICON_URL?: string; // https://[yourEmbedIcon].webp (optional)
        DISCORD_INVITE_URL: string; // https://discord.gg/[yourServer]
        SAVED_ADMIN_AUTHS_URL: string; // https://yourfile.json
        STADIUMS_URL: string; // https://yourfile.json
        KITS_URL: string; // https://yourfile.json
        UI_SESSION_SECRET: string;
        UI_AUTH_USERS: string; // format: [username1]:[password1],[username2]:[password2]
        DEV_HB_TOKEN: string; // thr1..
        HB_ROOM_NAME: string; // your room name 
        HB_ROOM_GEO?: string; // { "code": "TR", "lat": 12.34, "lon": 56.78 } (optional)
    };
};

declare const __BOT_VERSION__: string;
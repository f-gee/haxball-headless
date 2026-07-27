declare function HBInit(config: {
    roomName?: string;
    maxPlayers?: number;
    public?: boolean;
    noPlayer?: boolean;
    token?: string;
    [key: string]: any;
}): any;

// to check if (process.env.NODE_ENV !== "production")
declare const process: {
    env: {
        NODE_ENV: string;
        HAXBALL_ENV: string;
        DISCORD_ROOMSTATUS_URL: string; // https://discord.com/api/webhooks/[webhookId]/[token]/messages/[messageId]?thread_id=[threadId]
        DISCORD_ROOMPASSWORD_URL: string; // https://discord.com/api/webhooks/[webhookId]/[token]/messages/[messageId]?thread_id=[threadId]
        DISCORD_CHATLOGS_URL: string; // https://discord.com/api/webhooks/[webhookId]/[token]?thread_id=[threadId]
        DISCORD_ICON_URL: string;
        SAVED_ADMIN_AUTHS_URL: string;
        STADIUMS_URL: string;
        KITS_URL: string;
    };
};

declare const __BOT_VERSION__: string;
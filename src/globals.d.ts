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
        HB_TOKEN: string;
        DISCORD_WEBHOOK_URL: string;
    };
};
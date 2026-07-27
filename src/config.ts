// src/config.ts
export const Colors = {
    error: 0xFF4444,
    success: 0x44FF44,
    info: 0xFFFF44,
    admin: 0x00CCFF,
    developer: 0xFF00FF,
    system: 0xAAAAAA,
    // color names
    teal: 0x9ae5e5,
    pink: 0xfba9c4,
    gold: 0xffdf00,
    green: 0x92FF0E,
    orange: 0xff7944,
} as const;

export const Config = {
    colors: Colors,
    // discord: {
    //     webhookUrl: process.env.DISCORD_WEBHOOK_URL ?? "",
    // },
    haxballEnv: process.env.HAXBALL_ENV,
} as const;
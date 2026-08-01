const dotenv = require("dotenv");
const esbuild = require("esbuild");
const pkg = require("./package.json");
// 1. Parse .env file contents
const envConfig = dotenv.config().parsed || {};

// loudly fail if env is missing required variables
const REQUIRED = [
    "PASSWORDS_ADMIN",
    "PASSWORDS_SUPERADMIN",
    "PASSWORDS_DEVELOPER",
    "DISCORD_ROOMSTATUS_URL",
    "DISCORD_ROOMPASSWORD_URL",
    "DISCORD_CHATLOGS_URL",
    "UI_SESSION_SECRET",
    "UI_AUTH_USERS",
    "HB_ROOM_NAME",
    "HB_ROOM_GEO",
    "GEMINI_API_KEY",
    "HB_ROOM_PUBLIC",
    "DEV_HB_TOKEN",
];
const missing = REQUIRED.filter(k => !envConfig[k]);
if (missing.length) {
    console.error(`Missing required .env vars: ${missing.join(", ")}`);
    process.exit(1);
}

const envDefine = Object.entries(envConfig).reduce((acc, [key, value]) => {
    acc[`process.env.${key}`] = JSON.stringify(value);
    return acc;
}, {});

esbuild.build({
    entryPoints: ["src/main.ts"],
    outfile: "dist/bot.puppeteer.dev.js",
    bundle: true,
    globalName: "bot", // exposes exports as window.bot
    footer: {
        js: "Object.assign(globalThis, bot);" // assign bot to window so we can hot plug new functions
    },
    format: "iife",
    charset: 'utf8',
    platform: "browser",
    target: "es2020",
    define: {
        "process.env.NODE_ENV": '"development"',
        "process.env.HAXBALL_PLATFORM": '"puppeteer"',
        "process.env.BOT_VERSION": JSON.stringify(pkg.version),
        ...envDefine, // Spread all dynamically parsed .env variables
    },
}).catch((err) => { console.error(err); process.exit(1); });

esbuild.build({
    entryPoints: ["src/main.ts"],
    outfile: "dist/bot.puppeteer.prod.js",
    bundle: true,
    globalName: "bot", // exposes exports as window.bot
    footer: {
        js: "Object.assign(globalThis, bot);" // assign bot to window so we can hot plug new functions
    },
    format: "iife",
    charset: 'utf8',
    platform: "browser",
    target: "es2020",
    define: {
        "process.env.NODE_ENV": '"production"',
        "process.env.HAXBALL_PLATFORM": '"puppeteer"',
        "process.env.BOT_VERSION": JSON.stringify(pkg.version),
        ...envDefine, // Spread all dynamically parsed .env variables
    },
}).catch((err) => { console.error(err); process.exit(1); });

esbuild.build({
    entryPoints: ["src/main.ts"],
    outfile: "dist/bot.browser.dev.js",
    bundle: true,
    globalName: "bot", // exposes exports as window.bot
    footer: {
        js: "Object.assign(globalThis, bot);" // assign bot to window so we can hot plug new functions
    },
    format: "iife",
    charset: 'utf8',
    platform: "browser",
    target: "es2020",
    define: {
        "process.env.NODE_ENV": '"development"',
        "process.env.HAXBALL_PLATFORM": '"browser"',
        "process.env.BOT_VERSION": JSON.stringify(pkg.version),
        ...envDefine, // Spread all dynamically parsed .env variables
    },
}).catch((err) => { console.error(err); process.exit(1); });

esbuild.build({
    entryPoints: ["src/main.ts"],
    outfile: "dist/bot.browser.prod.js",
    bundle: true,
    minify: true,
    format: "iife",
    charset: 'utf8',
    platform: "browser",
    target: "es2020",
    define: {
        "process.env.NODE_ENV": '"development"',
        "process.env.HAXBALL_PLATFORM": '"browser"',
        "process.env.BOT_VERSION": JSON.stringify(pkg.version),
        ...envDefine, // Spread all dynamically parsed .env variables
    },
}).catch((err) => { console.error(err); process.exit(1); });

esbuild.build({
    entryPoints: ["src/main.ts"],
    outfile: "dist/bot.node.dev.js",
    bundle: true,
    format: "iife",
    charset: 'utf8',
    platform: "node",
    target: "es2020",
    banner: {
        js: `module.exports=(HBInit,hjsToken,hjsCallback)=>{`
    },
    footer: {
        js: `}`
    },
    define: {
        "process.env.NODE_ENV": '"development"',
        "process.env.HAXBALL_PLATFORM": '"node"',
        "process.env.BOT_VERSION": JSON.stringify(pkg.version),
        ...envDefine, // Spread all dynamically parsed .env variables
    },
}).catch((err) => { console.error(err); process.exit(1); });

esbuild.build({
    entryPoints: ["src/main.ts"],
    outfile: "dist/bot.node.prod.js",
    bundle: true,
    minify: true,
    format: "iife",
    charset: 'utf8',
    platform: "node",
    target: "es2020",
    banner: {
        js: `module.exports=(HBInit,hjsToken,hjsCallback)=>{`
    },
    footer: {
        js: `}`
    },
    define: {
        "process.env.NODE_ENV": '"production"',
        "process.env.HAXBALL_PLATFORM": '"node"',
        "process.env.BOT_VERSION": JSON.stringify(pkg.version),
        ...envDefine, // Spread all dynamically parsed .env variables
    },
}).catch((err) => { console.error(err); process.exit(1); });
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
    "DEV_HB_TOKEN",
    "GEMINI_API_KEY",
];
const missing = REQUIRED.filter(k => !envConfig[k]);
if (missing.length) {
    console.error(`Missing required .env vars: ${missing.join(", ")}`);
    process.exit(1);
}

// 2. Map only those .env keys to esbuild define format
// const envDefine = Object.entries(envConfig).reduce((acc, [key, value]) => {
//     acc[`process.env.${key}`] = JSON.stringify(value);
//     return acc;
// }, {});

esbuild.build({
    entryPoints: ["src/main.ts"],
    outfile: "dist/bundle.browser_dev.js",
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
        "process.env.HAXBALL_PLATFORM": JSON.stringify('browser'),
        //...envDefine, // Spread all dynamically parsed .env variables
        "__ENV__": JSON.stringify(envConfig), // <- inject the whole parsed .env object
        "__BOT_VERSION__": JSON.stringify(pkg.version),
    },
}).catch(() => process.exit(1));

esbuild.build({
    entryPoints: ["src/main.ts"],
    outfile: "dist/bundle.browser_prod.js",
    bundle: true,
    minify: true,
    format: "iife",
    charset: 'utf8',
    platform: "browser",
    target: "es2020",
    define: {
        "process.env.NODE_ENV": '"production"',
        "process.env.HAXBALL_PLATFORM": JSON.stringify('browser'),
        "__ENV__": JSON.stringify(envConfig),
        "__BOT_VERSION__": JSON.stringify(pkg.version),
    },
}).catch(() => process.exit(1));

esbuild.build({
    entryPoints: ["src/main.ts"],
    outfile: "dist/bundle.puppeteer_dev.js",
    bundle: true,
    minify: true,
    globalName: "bot",
    footer: {
        js: "Object.assign(globalThis, bot);" // assign bot to window so we can hot plug new functions
    },
    format: "iife",
    charset: 'utf8',
    platform: "browser",
    target: "es2020",
    define: {
        "process.env.NODE_ENV": '"development"',
        "process.env.HAXBALL_PLATFORM": JSON.stringify('puppeteer'),
        "__ENV__": JSON.stringify(envConfig),
        "__BOT_VERSION__": JSON.stringify(pkg.version),
    },
}).catch(() => process.exit(1));

esbuild.build({
    entryPoints: ["src/main.ts"],
    outfile: "dist/bundle.puppeteer_prod.js",
    bundle: true,
    minify: true,
    format: "iife",
    charset: 'utf8',
    platform: "browser",
    target: "es2020",
    define: {
        "process.env.NODE_ENV": '"production"',
        "process.env.HAXBALL_PLATFORM": JSON.stringify('puppeteer'),
        "__ENV__": JSON.stringify(envConfig),
        "__BOT_VERSION__": JSON.stringify(pkg.version),
    },
}).catch(() => process.exit(1));

esbuild.build({
    entryPoints: ["src/main.ts"],
    outfile: "dist/bundle.node_dev.js",
    bundle: true,
    format: "iife",
    charset: 'utf8',
    platform: "node",
    target: "es2020",
    define: {
        "process.env.NODE_ENV": '"development"',
        "process.env.HAXBALL_PLATFORM": '"node"',
        "__ENV__": JSON.stringify(envConfig),
        "__BOT_VERSION__": JSON.stringify(pkg.version),
    },
    banner: {
        js: `module.exports=(HBInit,hjsToken,hjsCallback)=>{`
    },
    footer: {
        js: `}`
    }
}).catch(() => process.exit(1));

esbuild.build({
    entryPoints: ["src/main.ts"],
    outfile: "dist/bundle.node_prod.js",
    bundle: true,
    format: "iife",
    charset: 'utf8',
    platform: "node",
    target: "es2020",
    define: {
        "process.env.NODE_ENV": '"production"',
        "process.env.HAXBALL_PLATFORM": '"node"',
        "__ENV__": JSON.stringify(envConfig),
        "__BOT_VERSION__": JSON.stringify(pkg.version),
    },
    banner: {
        js: `module.exports=(HBInit,hjsToken,hjsCallback)=>{`
    },
    footer: {
        js: `}`
    }
}).catch(() => process.exit(1));
const dotenv = require("dotenv");
const esbuild = require("esbuild");
const pkg = require("./package.json");
// 1. Parse ONLY the .env file contents
const envConfig = dotenv.config().parsed || {};

// 2. Map only those .env keys to esbuild define format
const envDefine = Object.entries(envConfig).reduce((acc, [key, value]) => {
    acc[`process.env.${key}`] = JSON.stringify(value);
    return acc;
}, {});

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
        ...envDefine, // Spread all dynamically parsed .env variables
        "process.env.HAXBALL_PLATFORM": JSON.stringify('browser'),
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
        ...envDefine, // Spread all dynamically parsed .env variables
        "process.env.HAXBALL_PLATFORM": JSON.stringify('puppeteer'),
        "__BOT_VERSION__": JSON.stringify(pkg.version),
    },
}).catch(() => process.exit(1));

/*
esbuild.build({
    entryPoints: ["src/main.ts"],
    outfile: "dist/bundle.node_dev.js",
    bundle: true,
    format: "iife",
    globalName: "bot",
    charset: 'utf8',
    platform: "node",
    target: "es2020",
    define: {
        "process.env.NODE_ENV": '"development"',
        ...envDefine, // Spread all dynamically parsed .env variables
        "process.env.HAXBALL_PLATFORM": '"node"',
        "__BOT_VERSION__": JSON.stringify(pkg.version),
    },
    banner: {
        js: `const HaxballJS = require('haxball.js').default; HaxballJS().then((HBInit) => {`
    },
    footer: {
        js: `});`
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
        ...envDefine, // Spread all dynamically parsed .env variables
        "process.env.HAXBALL_PLATFORM": '"node"',
        "__BOT_VERSION__": JSON.stringify(pkg.version),
    },
    banner: {
        js: `const HaxballJS = require('haxball.js').default; HaxballJS().then((HBInit) => {`
    },
    footer: {
        js: `});`
    }
}).catch(() => process.exit(1));
*/
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
        ...envDefine, // Spread all dynamically parsed .env variables
        "process.env.HAXBALL_PLATFORM": '"node"',
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
        ...envDefine, // Spread all dynamically parsed .env variables
        "process.env.HAXBALL_PLATFORM": '"node"',
        "__BOT_VERSION__": JSON.stringify(pkg.version),
    },
    banner: {
        js: `module.exports=(HBInit,hjsToken,hjsCallback)=>{`
    },
    footer: {
        js: `}`
    }
}).catch(() => process.exit(1));
require("dotenv").config();
const esbuild = require("esbuild");
const pkg = require("./package.json");

esbuild.build({
    entryPoints: ["src/main.ts"],
    bundle: true,
    format: "iife",
    globalName: "bot", // exposes exports as window.bot
    outfile: "dist/bundle.dev.js",
    define: {
        "process.env.NODE_ENV": '"development"',
        "process.env.DISCORD_WEBHOOK_URL": JSON.stringify(process.env.DISCORD_WEBHOOK_URL ?? ""),
        'process.env.HB_TOKEN': JSON.stringify(process.env.HB_TOKEN ?? ''),
        "__BOT_VERSION__": JSON.stringify(pkg.version),
    },
}).catch(() => process.exit(1));
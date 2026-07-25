// build.js (replacing your plain esbuild CLI call with a small script)
require("dotenv").config();
const esbuild = require("esbuild");

esbuild.build({
    entryPoints: ["src/main.ts"],
    bundle: true,
    format: "iife",
    outfile: "dist/bundle.dev.js",
    define: {
        "process.env.NODE_ENV": '"development"',
        "process.env.DISCORD_WEBHOOK_URL": JSON.stringify(process.env.DISCORD_WEBHOOK_URL ?? ""),
    },
}).catch(() => process.exit(1));
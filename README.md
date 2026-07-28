# Haxball Headless Server

Haxball headless bot, written in TypeScript, compiled with `tsc`, bundled with `esbuild`.

## Setup

```bash
git clone https://github.com/f-gee/haxball-headless.git
cd haxball-headless
npm install
```

## Environment:

.env file:

```
DISCORD_ROOMSTATUS_URL=https://discord.com/api/webhooks/[webhookId]/[token]/messages/[messageId]?thread_id=[threadId]
DISCORD_ROOMPASSWORD_URL=https://discord.com/api/webhooks/[webhookId]/[token]/messages/[messageId]?thread_id=[threadId]
DISCORD_CHATLOGS_URL=https://discord.com/api/webhooks/[webhookId]/[token]?thread_id=[threadId]
SAVED_ADMIN_AUTHS_URL=https://yourfile.json
STADIUMS_URL=https://yourfile.json
KITS_URL=https://yourfile.json
HB_ROOM_NAME=My Haxball Room
DEV_HB_TOKEN=thr1.haxballToken
```

## Build

`npm run build`

## Host a room
### Using puppeteer:
  - `node host_with_puppeteer.js`
  - visit `http://localhost:3000/createRoom?token=thr1.yourToken`
### Using haxball.js:
  - write your token in .env: `DEV_HB_TOKEN=thr1.yourToken`
  - `node dist/bundle.node_dev.js`
### In your own browser:
  - Copy and paste `dist/bundle.browser.js` to your browser's console
  - If you use `dist/bundle.browser_dev.js`, it reads the token from .env file, if not, solve the captcha if prompted

## TODO
- Write example JSON data files
- Check default admin passwords
- Pass geo param to HBInit
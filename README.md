# Haxball Headless Server

Haxball headless bot, written in TypeScript, compiled with `tsc`, bundled with `esbuild`.

## Setup

```bash
git clone https://github.com/f-gee/haxball-headless.git
cd haxball-headless
npm install
```

## Environment:

.env file: see `/src/globals.d.ts` for all possible variables

## Build

`npm run build`

## Host a room
### Using puppeteer or haxball.js:
  - Run the UI: `node ui/server.js` or `nohup node ui/server.js > out.log 2>&1 < /dev/null & disown`
  - visit `http://localhost:3001/`
  - select platform and enter your token
### In your own browser:
  - Copy and paste `dist/bundle.browser.js` to your browser's console
  - If you use `dist/bundle.browser_dev.js`, it reads the token from .env file, if not, solve the captcha if prompted

## Database environment:
  - An example database backend is provided in `/db_api` folder. If you want an actual database, you need to implement it elsewhere and provide DB_API_URL in .env

## TODO
- Add option to host development builds
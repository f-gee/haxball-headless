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
  - Run the UI: `node ui/server.js`
  - visit `http://localhost:3001/`
  - select host method and enter your token
### In your own browser:
  - Copy and paste `dist/bundle.browser.js` to your browser's console
  - If you use `dist/bundle.browser_dev.js`, it reads the token from .env file, if not, solve the captcha if prompted

## TODO
- Write example JSON data files
- Check default admin passwords
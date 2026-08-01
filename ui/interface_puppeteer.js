const fs = require('fs');
const path = require('path');
//const puppeteer = require("puppeteer-core");
const puppeteer = require("puppeteer");

let browser = null;
let page = null;
//let isRoomUp = false;

const delay = ms => new Promise(res => setTimeout(res, ms));

const getOrLaunchBrowser = async () => {
    if (browser) {
        return browser;
    } else {
        // let executablePath;

        // if (process.platform === 'linux') {
        //     executablePath = '/usr/bin/chromium';
        // } else {
        //     executablePath = 'C:\\Program Files\\BraveSoftware\\Brave-Browser\\Application\\brave.exe';
        // }

        // // Safety check: verify the file actually exists before launching
        // if (!fs.existsSync(executablePath)) {
        //     throw new Error(`[Puppeteer Error] Executable not found at path: ${executablePath}`);
        // }
        browser = await puppeteer.launch({
            //channel: 'chrome',
            //executablePath: "/usr/bin/chromium",
            //executablePath: "C:\\Program Files\\BraveSoftware\\Brave-Browser\\Application\\brave.exe",
            //executablePath: executablePath,
            headless: true,
            userDataDir: process.cwd() + '/puppeteer-data',
            args: [
                "--no-sandbox",
                "--disable-setuid-sandbox",
                "--disable-features=WebRtcHideLocalIpsWithMdns",
                "--disable-web-security",
                "--allow-running-insecure-content",
                "--disable-features=BlockInsecurePrivateNetworkRequests",
                "--disable-dev-shm-usage",
                "--disable-gpu",
            ]
        });
        return browser;
    }
}

async function createRoom(token, environment) {
    try {
        const bundlePath = path.join(__dirname, '..', 'dist', `bot.puppeteer.${environment}.js`);
        console.log(`puppeteer.createRoom, filePath: ${bundlePath}`);
        const botCode = fs.readFileSync(bundlePath, 'utf8');
        const browser = await getOrLaunchBrowser();
        page = await browser.newPage();
        await page.goto("https://www.haxball.com/headless", { waitUntil: "networkidle2" });
        await page.waitForFunction(() => typeof HBInit !== "undefined");
        await page.evaluate((t) => { window.HB_TOKEN = t; }, token);

        page.on('console', async (msg) => {
            const args = await Promise.all(msg.args().map(arg => arg.jsonValue()));
            console.log(...args);
        });

        page.on("pageerror", err => {
            console.error("[PAGE ERROR]", err);
        });
        await page.addScriptTag({ content: botCode });
        //isRoomUp = true;
        //return { ok: true, message: "room created" };
        const room = await page.evaluate(() => {
            return window.room;
        });
        const roomExists = await page.evaluate(() => typeof window.room !== "undefined");
        console.log("room created:", roomExists);
        //const available = await getAvailableGlobals(page, ['room', 'gameManager', 'scoreboard']);
        //console.log(available); // ['room', 'gameManager']
        return { page };

    } catch (err) {
        console.log("error in puppeteer createRoom:");
        console.log(err);
        // Clean up page if something failed before sending an error response
        if (page) await page.close().catch(() => { });

        // Ensure we only respond if headers haven't been sent yet
        return { ok: false, error: err.message };
    }
};

async function closeRoom() {
    await page.evaluate("room.sendAnnouncement('🤖 ROOM IS CLOSING! 🤖');");
    await delay(5000);
    await page.close().catch(() => { });
    //isRoomUp = false;
    return { ok: true, message: "room closed" };
};

async function safeEvaluate(code) {
    try {
        const result = await page.evaluate((codeStr) => {
            try {
                // eval the passed-in code string inside the page context
                const value = eval(codeStr);
                return { ok: true, value };
            } catch (err) {
                return { ok: false, error: { message: err.message, stack: err.stack } };
            }
        }, code);
        return result;
    } catch (err) {
        // this catches Puppeteer-level failures: page crashed, target closed, etc.
        return { ok: false, error: { message: err.message, stack: err.stack } };
    }
}

module.exports = {
    createRoom,
    closeRoom,
    safeEvaluate,
    browser,
    page
};
const express = require('express');
const fs = require('fs');
const puppeteer = require("puppeteer-core");

const app = express();
app.use(express.json());

let browser, page;
let isRoomUp = false;

const delay = ms => new Promise(res => setTimeout(res, ms));

const parseHaxballToken = (tokenInput) => {
    const tokenArray = tokenInput.split('"')
    return tokenArray[Math.floor(tokenArray.length / 2)];
};

const getOrLaunchBrowser = async () => {
    if (browser) {
        return browser;
    } else {
        let executablePath;

        if (process.platform === 'linux') {
            executablePath = '/usr/bin/chromium';
        } else {
            executablePath = 'C:\\Program Files\\BraveSoftware\\Brave-Browser\\Application\\brave.exe';
        }

        // Safety check: verify the file actually exists before launching
        if (!fs.existsSync(executablePath)) {
            throw new Error(`[Puppeteer Error] Executable not found at path: ${executablePath}`);
        }
        browser = await puppeteer.launch({
            //channel: 'chrome',
            //executablePath: "/usr/bin/chromium",
            //executablePath: "C:\\Program Files\\BraveSoftware\\Brave-Browser\\Application\\brave.exe",
            executablePath: executablePath,
            headless: true,
            userDataDir: process.cwd() + '/puppeteer-data',
            args: [
                "--no-sandbox",
                "--disable-setuid-sandbox",
                "--disable-features=WebRtcHideLocalIpsWithMdns",
                "--disable-web-security",
                "--allow-running-insecure-content",
                "--disable-features=BlockInsecurePrivateNetworkRequests",
                "--disable-dev-shm-usage"
            ]
        });
        return browser;
    }
}

app.get('/', (req, res, next) => {
    res.render('haxball_puppeteer', { isRoomUp });
});

app.get('/createRoom', async (req, res, next) => {
    let page = null;

    try {
        const token = parseHaxballToken(req.query.token);
        const botCode = fs.readFileSync(process.cwd() + '/dist/bundle.puppeteer.js', 'utf8');

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
        // Send single, successful response here
        return res.json({ ok: true, message: "room created" });

    } catch (err) {
        // Clean up page if something failed before sending an error response
        if (page) await page.close().catch(() => { });

        // Ensure we only respond if headers haven't been sent yet
        if (!res.headersSent) {
            return res.status(500).json({ ok: false, error: err.message });
        }
    }
});

app.get('/closeRoom', async (req, res, next) => {
    await page.evaluate("room.sendAnnouncement('🤖 ROOM IS CLOSING! 🤖');");
    await delay(5000);
    await page.close();
    isRoomUp = false;
    res.json({ ok: true, message: "room closed" });
});
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server listening on port ${PORT}`));
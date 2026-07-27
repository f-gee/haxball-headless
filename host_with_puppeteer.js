
async function launchRoomAndGetLink(token) {
    const b = await getBrowser();
    const page = await b.newPage();

    let resolveLink;
    const linkPromise = new Promise((resolve) => { resolveLink = resolve; });

    await page.exposeFunction("__onRoomLinkReceived", (url) => {
        resolveLink(url);
    });

    await page.goto("https://www.haxball.com/headlesshost", { waitUntil: "domcontentloaded" });

    // Make the token available inside the page before bundle.min.js runs
    await page.evaluate((t) => { window.HB_TOKEN = t; }, token);

    const bundleCode = fs.readFileSync(BUNDLE_PATH, "utf8");
    await page.addScriptTag({ content: bundleCode });

    await page.evaluate(() => {
        const attach = () => {
            if (!window.room) {
                setTimeout(attach, 50);
                return;
            }
            const original = window.room.onRoomLink;
            window.room.onRoomLink = (url) => {
                if (typeof original === "function") original(url);
                window.__onRoomLinkReceived(url);
            };
        };
        attach();
    });

    const roomLink = await Promise.race([
        linkPromise,
        new Promise((_, reject) =>
            setTimeout(() => reject(new Error("Timed out waiting for room link")), 20000)
        ),
    ]);

    return { page, roomLink };
}

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
        browser = await puppeteer.launch({
            //executablePath: "/usr/bin/chromium",
            executablePath: "C:\\Program Files\\BraveSoftware\\Brave-Browser\\Application\\brave.exe",
            //channel: 'chrome',
            headless: true,
            userDataDir: process.cwd() + '/puppeteer-data',
            args: [
                "--no-sandbox",
                "--disable-setuid-sandbox",
                "--disable-features=WebRtcHideLocalIpsWithMdns",
                "--disable-web-security",
                "--allow-running-insecure-content",
                "--disable-features=BlockInsecurePrivateNetworkRequests"
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
        const botCode = fs.readFileSync(process.cwd() + '/dist/bundle.dev.js', 'utf8');

        const browser = await getOrLaunchBrowser();
        page = await browser.newPage();

        let resolveLink;
        const linkPromise = new Promise((resolve) => { resolveLink = resolve; });

        // Expose function strictly to resolve the local promise (NO res.json here)
        await page.exposeFunction("__onRoomLinkReceived", (url) => {
            resolveLink(url);
        });

        await page.evaluate((t) => { window.HB_TOKEN = t; }, token);
        await page.goto("https://www.haxball.com/headless", { waitUntil: "networkidle2" });

        await page.waitForFunction(() => typeof HBInit !== "undefined");

        page.on('console', async (msg) => {
            const args = await Promise.all(msg.args().map(arg => arg.jsonValue()));
            console.log(...args);
        });

        page.on("pageerror", err => {
            console.error("[PAGE ERROR]", err);
        });

        await page.addScriptTag({ content: botCode });

        await page.evaluate(() => {
            const attach = () => {
                if (!window.room) {
                    setTimeout(attach, 50);
                    return;
                }
                const original = window.room.onRoomLink;
                window.room.onRoomLink = (url) => {
                    if (typeof original === "function") original(url);
                    window.__onRoomLinkReceived(url);
                };
            };
            attach();
        });

        // Wait for either the room link or the 20s timeout
        const roomLink = await Promise.race([
            linkPromise,
            new Promise((_, reject) =>
                setTimeout(() => reject(new Error("Timed out waiting for room link")), 20000)
            ),
        ]);

        // Send single, successful response here
        return res.json({ ok: true, message: "room created: " + roomLink, roomLink });

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
process.on("unhandledRejection", (reason) => {
    console.error("Unhandled Rejection:", reason);
});

process.on("uncaughtException", (err) => {
    console.error("Uncaught Exception:", err);
});

import 'dotenv/config';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import session from 'express-session';
import puppeteerManager from './interface_puppeteer.js';
import haxballJsManager from './interface_haxballjs.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.set('view engine', 'pug');
app.set('views', path.join(__dirname, 'views'));

app.use(session({
    secret: process.env.UI_SESSION_SECRET || 'change-me-in-.env',
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 1000 * 60 * 60 * 24 } // 1 day
}));

const loadUsers = () => {
    const raw = process.env.UI_AUTH_USERS || '';
    return Object.fromEntries(
        raw.split(',').filter(Boolean).map(pair => pair.split(':'))
    );
};

const requireAuth = (req, res, next) => {
    if (req.session.user) return next();
    return res.redirect('/login');
};

// --- auth routes ---
app.get('/login', (req, res) => {
    res.render('login', { error: null });
});

app.post('/login', (req, res) => {
    const { username, password } = req.body;
    const users = loadUsers();

    if (users[username] !== password) {
        return res.render('login', { error: 'Invalid username or password' });
    }

    req.session.user = username;
    res.redirect('/');
});

app.post('/logout', (req, res) => {
    req.session.destroy(() => res.redirect('/login'));
});

// --- everything below this line requires auth ---
app.use(requireAuth);

// tracks whether the room has been hosted yet
const state = {
    hosted: false,
    mode: null, // 'puppeteer' | 'haxballjs'
    room: null,  // only for haxball.js
    page: null,  // only for puppeteer
    url: null,
};

const parseHaxballToken = (tokenInput) => {
    const tokenArray = tokenInput.split('"')
    return tokenArray[Math.floor(tokenArray.length / 2)];
};

app.get('/test', (req, res) => {
    res.send('test');
});

app.get('/', (req, res) => {
    if (!state.hosted) {
        return res.render('host');
    }
    res.render('console', { mode: state.mode, url: state.url });
});

app.post('/host', async (req, res) => {
    const { mode, token, environment } = req.body;
    const envFileName = environment === "development" ? "dev" : "prod";

    if (!token || !mode) {
        return res.status(400).send('Missing mode or token');
    }

    try {
        const parsedToken = parseHaxballToken(token);
        if (mode === 'puppeteer') {
            const result = await puppeteerManager.createRoom(parsedToken, envFileName);
            state.page = result.page;
        } else if (mode === 'haxballjs') {
            const result = await haxballJsManager.createRoom(parsedToken, envFileName);
            state.room = result.room;
            state.url = result.url;
        } else {
            return res.status(400).send('Invalid mode');
        }

        state.hosted = true;
        state.mode = mode;
        res.redirect('/');
    } catch (err) {
        res.status(500).send(`Failed to host: ${err.message}\n${err.stack}`);
        //res.status(500).json({ error: err.message, stack: err.stack, });
    }
});

app.post('/eval', async (req, res) => {
    if (!state.hosted) return res.status(400).json({ result: 'Room not hosted yet' });
    const { code } = req.body;
    let result;
    try {
        let evalResult;
        if (state.mode === "puppeteer") {
            evalResult = await puppeteerManager.safeEvaluate(code);
        } else {
            evalResult = await haxballJsManager.safeEvaluate(code);
        }

        if (!evalResult.ok) {
            console.log("EVAL ERROR:", evalResult.error);
            return res.json({ result: `Evaluation error: ${evalResult.error}` });
        }
        result = evalResult.value;
        result = typeof result === 'object' ? JSON.stringify(result) : String(result);
    } catch (err) {
        result = `Error: ${err.message}`;
    }
    res.json({ result });
});

app.post('/chat', (req, res) => {
    if (!state.hosted) return res.status(400).json({ ok: false });
    const { text } = req.body;
    if (state.mode === "puppeteer") {
        puppeteerManager.safeEvaluate(`room.sendAnnouncement("${text}")`);
    } else {
        state.room.sendAnnouncement(`${text}`);
    }
    res.json({ ok: true });
});

app.get('/close', (req, res) => {
    if (!state.hosted) return res.status(400).json({ ok: false });
    fetch(process.env.DISCORD_ROOMSTATUS_URL, {
        method: "PATCH",
        body: JSON.stringify({
            "embeds": [
                {
                    "title": "no haxball :(",
                    "description": "haxball room is closed",
                    "color": 0x92FF0E,
                    "footer": {
                        "text": `gg`,
                        "icon_url": process.env.DISCORD_ICON_URL,
                    },
                    "timestamp": new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString().replace("Z", "+03:00")
                }
            ]
        }),
        headers: {
            "Content-Type": "application/json",
        },
    });
    if (state.mode === "puppeteer") {
        puppeteerManager.closeRoom();
    } else {
        haxballJsManager.closeRoom();
    }
    res.json({ ok: true });
});

app.listen(3001, () => console.log('UI on port 3001'));
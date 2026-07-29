import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import puppeteerManager from './interface_puppeteer.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.set('view engine', 'pug');
app.set('views', path.join(__dirname, 'views'));

// tracks whether the room has been hosted yet
const state = {
    hosted: false,
    mode: null, // 'puppeteer' | 'haxballjs'
    room: null,  // only for haxball.js
    page: null,  // only for puppeteer
};

app.get('/test', (req, res) => {
    res.send('test');
});

app.get('/', (req, res) => {
    if (!state.hosted) {
        return res.render('host');
    }
    res.render('console', { mode: state.mode });
});

app.post('/host', async (req, res) => {
    const { mode, token } = req.body;

    if (!token || !mode) {
        return res.status(400).send('Missing mode or token');
    }

    try {
        if (mode === 'puppeteer') {
            const result = await puppeteerManager.createRoom(token);
            state.page = result.page;
            //state.room = result.room;
            // console.log("room: ");
            // console.log(state.room);
            console.log("page2: ");
            console.log(state.page);
        } else if (mode === 'haxballjs') {
            // state.room = await startWithHaxballJs(token);
        } else {
            return res.status(400).send('Invalid mode');
        }

        state.hosted = true;
        state.mode = mode;
        res.redirect('/');
    } catch (err) {
        res.status(500).send(`Failed to host: ${err.message}`);
    }
});

app.post('/eval', async (req, res) => {
    if (!state.hosted) return res.status(400).json({ result: 'Room not hosted yet' });
    const { code } = req.body;
    let result;
    try {
        if (state.mode === "puppeteer") {
            //result = await state.page.evaluate(`(${code})()`);
            //result = await state.page.evaluate(code);
            result = await puppeteerManager.safeEvaluate(code);
            if (!result.ok) {
                return res.json({ result: `Evaluation error: ${result.error.message}\n${result.error.stack}` });
            }
            result = result.value;
        } else {
            result = eval(code); // has access to state.room in this scope
        }
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
    if (state.mode === "puppeteer") {
        puppeteerManager.closeRoom();
    } else {
        process.exit();
    }
    res.json({ ok: true });
});

app.listen(3001, '127.0.0.1', () => console.log('UI on http://localhost:3001'));
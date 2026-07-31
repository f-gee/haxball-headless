const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(express.json());

const DB_PATH = path.join(__dirname, 'mock_database.json');

// --- simple JSON-file "database" ---

function loadDb() {
    if (!fs.existsSync(DB_PATH)) return {};
    try {
        return JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
    } catch (err) {
        console.error('Failed to parse players.json, starting fresh:', err);
        return {};
    }
}

function saveDb(db) {
    fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
}

// --- routes ---

// POST /getPlayer { auth }
app.post('/getPlayer', (req, res) => {
    const { auth } = req.body;
    if (!auth) return res.status(400).json({ error: 'auth is required' });

    const db = loadDb();
    const player = db[auth];

    if (!player) return res.status(404).json({ error: 'player not found' });
    res.json(player);
});

// POST /updatePlayer { auth, playerData }
app.post('/updatePlayer', (req, res) => {
    const { auth, playerData } = req.body;
    if (!auth) return res.status(400).json({ error: 'auth is required' });
    if (!playerData || typeof playerData !== 'object') {
        return res.status(400).json({ error: 'playerData must be an object' });
    }

    const db = loadDb();
    db[auth] = { ...db[auth], ...playerData, auth };
    saveDb(db);

    res.json(db[auth]);
});

// POST /batchUpdatePlayers { playersDataArray }
app.post('/batchUpdatePlayers', (req, res) => {
    const { playersDataArray } = req.body;
    if (!Array.isArray(playersDataArray)) {
        return res.status(400).json({ error: 'playersDataArray must be an array' });
    }

    const db = loadDb();
    const updated = [];

    for (const playerData of playersDataArray) {
        if (!playerData || !playerData.auth) continue; // skip invalid entries
        const { auth } = playerData;
        db[auth] = { ...db[auth], ...playerData, auth };
        updated.push(db[auth]);
    }

    saveDb(db);
    res.json({ updatedCount: updated.length, players: updated });
});

const PORT = process.env.PORT || 3002;
app.listen(PORT, () => {
    console.log(`Players API listening on port ${PORT}`);
});
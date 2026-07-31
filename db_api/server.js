const express = require('express');
const path = require('path');
const Database = require('better-sqlite3');

const app = express();
app.use(express.json());

const DB_PATH = path.join(__dirname, 'players.db');
const db = new Database(DB_PATH);

// WAL mode = better concurrent read/write performance than default journal mode
db.pragma('journal_mode = WAL');

// --- schema ---

db.exec(`
  CREATE TABLE IF NOT EXISTS players (
    auth TEXT PRIMARY KEY,
    name TEXT,
    elo INTEGER DEFAULT 1000,
    totalGames INTEGER DEFAULT 0,
    totalWins INTEGER DEFAULT 0,
    lastActivity TEXT
  )
`);

// --- prepared statements (compiled once, reused — fast) ---

const getPlayerStmt = db.prepare('SELECT * FROM players WHERE auth = ?');

const upsertPlayerStmt = db.prepare(`
  INSERT INTO players (auth, name, elo, totalGames, totalWins, lastActivity)
  VALUES (@auth, @name, @elo, @totalGames, @totalWins, @lastActivity)
  ON CONFLICT(auth) DO UPDATE SET
    name = COALESCE(excluded.name, players.name),
    elo = COALESCE(excluded.elo, players.elo),
    totalGames = COALESCE(excluded.totalGames, players.totalGames),
    totalWins = COALESCE(excluded.totalWins, players.totalWins),
    lastActivity = COALESCE(excluded.lastActivity, players.lastActivity)
`);

// --- helpers ---

function toRow(auth, playerData) {
    return {
        auth,
        name: playerData.name ?? null,
        elo: playerData.elo ?? null,
        totalGames: playerData.totalGames ?? null,
        totalWins: playerData.totalWins ?? null,
        lastActivity: playerData.lastActivity ?? null,
    };
}

function fromRow(row) {
    if (!row) return null;
    return row;
}

// --- routes ---

// POST /getPlayer { auth }
app.post('/getPlayer', (req, res) => {
    const { auth } = req.body;
    if (!auth) return res.status(400).json({ error: 'auth is required' });

    const row = getPlayerStmt.get(auth);
    if (!row) return res.status(404).json({ error: 'player not found' });

    res.json(fromRow(row));
});

// POST /updatePlayer { auth, playerData }
app.post('/updatePlayer', (req, res) => {
    const { auth, playerData } = req.body;
    if (!auth) return res.status(400).json({ error: 'auth is required' });
    if (!playerData || typeof playerData !== 'object') {
        return res.status(400).json({ error: 'playerData must be an object' });
    }

    upsertPlayerStmt.run(toRow(auth, playerData));
    const updated = getPlayerStmt.get(auth);

    res.json(fromRow(updated));
});

// POST /batchUpdatePlayers { playersDataArray }
app.post('/batchUpdatePlayers', (req, res) => {
    const { playersDataArray } = req.body;
    if (!Array.isArray(playersDataArray)) {
        return res.status(400).json({ error: 'playersDataArray must be an array' });
    }

    const updatedAuths = [];

    // wrap all upserts in a single transaction — either all succeed or none do,
    // and it's much faster than running each INSERT separately
    const runBatch = db.transaction((entries) => {
        for (const playerData of entries) {
            if (!playerData || !playerData.auth) continue; // skip invalid entries
            upsertPlayerStmt.run(toRow(playerData.auth, playerData));
            updatedAuths.push(playerData.auth);
        }
    });

    runBatch(playersDataArray);

    const players = updatedAuths.map(auth => fromRow(getPlayerStmt.get(auth)));

    res.json({ updatedCount: players.length, players });
});

const PORT = process.env.PORT || 3002;
app.listen(PORT, () => {
    console.log(`Players API (SQLite) listening on port ${PORT}`);
});
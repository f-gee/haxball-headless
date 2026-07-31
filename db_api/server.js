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
    elo INTEGER DEFAULT 1600,
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

function log(action, message) {
    console.log(`[DB] ${new Date().toISOString()} ${action} — ${message}`);
}

// --- routes ---

// POST /getPlayer { auth }
app.post('/getPlayer', (req, res) => {
    const { auth } = req.body;
    if (!auth) {
        log('GET', 'rejected — auth is required');
        return res.status(400).json({ error: 'auth is required' });
    }

    const row = getPlayerStmt.get(auth);
    if (!row) {
        log('GET', `not found — auth=${auth}`);
        return res.status(404).json({ error: 'player not found' });
    }

    //log('GET', `auth=${auth} name=${row.name}`);
    log('GET', `auth=${auth} name=${JSON.stringify(row)}`);
    res.json(fromRow(row));
});

// POST /updatePlayer { auth, playerData }
app.post('/updatePlayer', (req, res) => {
    const { auth, playerData } = req.body;
    if (!auth) {
        log('UPDATE', 'rejected — auth is required');
        return res.status(400).json({ error: 'auth is required' });
    }
    if (!playerData || typeof playerData !== 'object') {
        log('UPDATE', `rejected — playerData must be an object (auth=${auth})`);
        return res.status(400).json({ error: 'playerData must be an object' });
    }

    const existed = !!getPlayerStmt.get(auth);
    upsertPlayerStmt.run(toRow(auth, playerData));
    const updated = getPlayerStmt.get(auth);

    log('UPDATE', `${existed ? 'updated' : 'created'} auth=${auth} fields=${Object.keys(playerData).join(',')}`);
    res.json(fromRow(updated));
});

// POST /batchUpdatePlayers { playersDataArray }
app.post('/batchUpdatePlayers', (req, res) => {
    const { playersDataArray } = req.body;
    if (!Array.isArray(playersDataArray)) {
        log('BATCH', 'rejected — playersDataArray must be an array');
        return res.status(400).json({ error: 'playersDataArray must be an array' });
    }

    const updatedAuths = [];
    const skipped = [];

    // wrap all upserts in a single transaction — either all succeed or none do,
    // and it's much faster than running each INSERT separately
    const runBatch = db.transaction((entries) => {
        for (const playerData of entries) {
            if (!playerData || !playerData.auth) {
                skipped.push(playerData);
                continue; // skip invalid entries
            }
            console.log(`update: ${JSON.stringify(playerData)}`);
            upsertPlayerStmt.run(toRow(playerData.auth, playerData));
            updatedAuths.push(playerData.auth);
        }
    });

    runBatch(playersDataArray);

    const players = updatedAuths.map(auth => fromRow(getPlayerStmt.get(auth)));

    log('BATCH', `updated ${players.length} player(s)${skipped.length ? `, skipped ${skipped.length} invalid entr${skipped.length === 1 ? 'y' : 'ies'}` : ''} — auths=[${updatedAuths.join(', ')}]`);
    res.json({ updatedCount: players.length, players });
});

const PORT = process.env.PORT || 3002;
app.listen(PORT, () => {
    console.log(`Players API (SQLite) listening on port ${PORT}`);
});
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
// NOTE: CREATE TABLE IF NOT EXISTS only applies to a fresh DB. If players.db
// already exists (created by the old schema without NOT NULL/CHECK), these
// constraints will NOT retroactively apply. See migration note at bottom of file.

db.exec(`
  CREATE TABLE IF NOT EXISTS players (
    auth TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    elo INTEGER NOT NULL DEFAULT 1600,
    totalGames INTEGER NOT NULL DEFAULT 0,
    totalWins INTEGER NOT NULL DEFAULT 0,
    lastActivity TEXT
  )
`);

// --- prepared statements (compiled once, reused — fast) ---

const getPlayerStmt = db.prepare('SELECT * FROM players WHERE auth = ?');

// COALESCE now appears on BOTH sides:
//  - insert values: falls back to sane defaults when a new player is created with partial data
//  - ON CONFLICT: falls back to the existing row's value when an update omits a field
const upsertPlayerStmt = db.prepare(`
  INSERT INTO players (auth, name, elo, totalGames, totalWins, lastActivity)
  VALUES (
    @auth,
    @name,
    COALESCE(@elo, 1600),
    COALESCE(@totalGames, 0),
    COALESCE(@totalWins, 0),
    @lastActivity
  )
  ON CONFLICT(auth) DO UPDATE SET
    name = COALESCE(excluded.name, players.name),
    elo = COALESCE(excluded.elo, players.elo),
    totalGames = COALESCE(excluded.totalGames, players.totalGames),
    totalWins = COALESCE(excluded.totalWins, players.totalWins),
    lastActivity = COALESCE(excluded.lastActivity, players.lastActivity)
`);

const topByEloStmt = db.prepare(`
  SELECT auth, name, elo, totalGames, totalWins, lastActivity
  FROM players
  ORDER BY elo DESC
  LIMIT ?
`);

const topByWinRateStmt = db.prepare(`
  SELECT auth, name, elo, totalGames, totalWins, lastActivity,
         CAST(totalWins AS REAL) / totalGames AS winRate
  FROM players
  WHERE totalGames >= ?
  ORDER BY winRate DESC, totalGames DESC
  LIMIT ?
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

// Validates a playerData payload. `isNewPlayer` tightens the rules (name required).
// Returns an array of error strings; empty array = valid.
function validatePlayerData(playerData, isNewPlayer) {
    const errors = [];

    if (isNewPlayer && (!playerData.name || typeof playerData.name !== 'string' || !playerData.name.trim())) {
        errors.push('name is required to create a new player');
    }
    if (playerData.name !== undefined && playerData.name !== null && typeof playerData.name !== 'string') {
        errors.push('name must be a string');
    }
    if (playerData.elo !== undefined && playerData.elo !== null && !Number.isFinite(playerData.elo)) {
        errors.push('elo must be a number');
    }
    if (playerData.totalGames !== undefined && playerData.totalGames !== null && !Number.isInteger(playerData.totalGames)) {
        errors.push('totalGames must be an integer');
    }
    if (playerData.totalWins !== undefined && playerData.totalWins !== null && !Number.isInteger(playerData.totalWins)) {
        errors.push('totalWins must be an integer');
    }

    return errors;
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

    log('GET', `auth=${auth} name=${row.name}`);
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

    const existing = getPlayerStmt.get(auth);
    const errors = validatePlayerData(playerData, !existing);
    if (errors.length) {
        log('UPDATE', `rejected — auth=${auth} errors=${errors.join('; ')}`);
        return res.status(400).json({ error: errors.join('; ') });
    }

    upsertPlayerStmt.run(toRow(auth, playerData));
    const updated = getPlayerStmt.get(auth);

    log('UPDATE', `${existing ? 'updated' : 'created'} auth=${auth} fields=${Object.keys(playerData).join(',')}`);
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
                skipped.push({ playerData, reason: 'missing auth' });
                continue;
            }

            const existing = getPlayerStmt.get(playerData.auth);
            const errors = validatePlayerData(playerData, !existing);
            if (errors.length) {
                skipped.push({ playerData, reason: errors.join('; ') });
                continue;
            }

            upsertPlayerStmt.run(toRow(playerData.auth, playerData));
            updatedAuths.push(playerData.auth);
        }
    });

    runBatch(playersDataArray);

    const players = updatedAuths.map(auth => fromRow(getPlayerStmt.get(auth)));

    log('BATCH', `updated ${players.length} player(s)${skipped.length ? `, skipped ${skipped.length} invalid entr${skipped.length === 1 ? 'y' : 'ies'}` : ''} — auths=[${updatedAuths.join(', ')}]`);
    if (skipped.length) {
        log('BATCH', `skip reasons: ${skipped.map(s => `${s.playerData?.auth ?? '?'}: ${s.reason}`).join(' | ')}`);
    }
    res.json({ updatedCount: players.length, players, skipped });
});

// GET /topPlayers?by=elo|winrate&limit=10&minGames=10
app.get('/topPlayers', (req, res) => {
    const by = (req.query.by || 'elo').toString();
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 10, 1), 100);
    const minGames = Math.max(parseInt(req.query.minGames, 10) || 0, 0);

    let rows;
    if (by === 'winrate') {
        rows = topByWinRateStmt.all(minGames, limit);
    } else if (by === 'elo') {
        rows = topByEloStmt.all(limit);
    } else {
        log('TOP', `rejected — unknown by=${by}`);
        return res.status(400).json({ error: `unknown 'by' value: '${by}' (use 'elo' or 'winrate')` });
    }

    log('TOP', `by=${by} limit=${limit}${by === 'winrate' ? ` minGames=${minGames}` : ''} -> ${rows.length} result(s)`);
    res.json(rows);
});

const PORT = process.env.PORT || 3002;
app.listen(PORT, () => {
    console.log(`Players API (SQLite) listening on port ${PORT}`);
});

// --- migration note ---
// If players.db already exists from before this change, the new NOT NULL
// constraint won't be applied to the existing table (SQLite ALTER TABLE can't
// add NOT NULL to an existing column). To bring an existing DB in line,
// backfill any NULLs manually, e.g.:
//   UPDATE players SET name = 'Unknown_' || auth WHERE name IS NULL;
//   UPDATE players SET elo = 1600 WHERE elo IS NULL;
//   UPDATE players SET totalGames = 0 WHERE totalGames IS NULL;
//   UPDATE players SET totalWins = 0 WHERE totalWins IS NULL;
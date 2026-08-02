// db_api/dbBackup.js
//
// Usage:
//   node dbBackup.js backup [outputPath]
//   node dbBackup.js restore <backupPath>
//
// Backup:
//   Uses better-sqlite3's built-in Online Backup API (db.backup()), which is
//   WAL-safe and works correctly even while the live server has the DB open.
//   No manual checkpointing, no worrying about -wal/-shm files.
//
// Restore:
//   Validates the backup file has a 'players' table before touching anything,
//   safety-backs-up your current players.db first, then overwrites it.
//   STOP db_api/server.js before running restore — copying over a file that
//   another process has open can corrupt it.

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DB_PATH = path.join(__dirname, 'players.db');
const BACKUP_DIR = path.join(__dirname, 'backups');

function timestamp() {
    return new Date().toISOString().replace(/[:.]/g, '-');
}

async function backup(destPath) {
    if (!fs.existsSync(DB_PATH)) {
        console.error(`No database found at ${DB_PATH}`);
        process.exitCode = 1;
        return;
    }

    const out = destPath ? path.resolve(destPath) : path.join(BACKUP_DIR, `players-${timestamp()}.db`);
    fs.mkdirSync(path.dirname(out), { recursive: true });

    // readonly: true — backup never needs to write to the source, and this
    // lets you run it safely alongside the live server without lock contention
    const db = new Database(DB_PATH, { readonly: true });
    try {
        await db.backup(out);
        console.log(`Backup complete: ${out}`);
    } catch (err) {
        console.error('Backup failed:', err.message);
        process.exitCode = 1;
    } finally {
        db.close();
    }
}

function restore(srcPath) {
    if (!srcPath) {
        console.error('Usage: node dbBackup.js restore <path-to-backup.db>');
        process.exitCode = 1;
        return;
    }

    const resolvedSrc = path.resolve(srcPath);
    if (!fs.existsSync(resolvedSrc)) {
        console.error(`Backup file not found: ${resolvedSrc}`);
        process.exitCode = 1;
        return;
    }

    // Sanity check: refuse to restore a file that isn't actually your players DB
    const testDb = new Database(resolvedSrc, { readonly: true });
    const tables = testDb.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
    testDb.close();
    if (!tables.some((t) => t.name === 'players')) {
        console.error(`Refusing to restore: ${resolvedSrc} has no 'players' table.`);
        process.exitCode = 1;
        return;
    }

    // Safety-backup whatever is currently live before overwriting it
    if (fs.existsSync(DB_PATH)) {
        const safetyPath = path.join(BACKUP_DIR, `pre-restore-${timestamp()}.db`);
        fs.mkdirSync(path.dirname(safetyPath), { recursive: true });
        fs.copyFileSync(DB_PATH, safetyPath);
        console.log(`Current players.db backed up to ${safetyPath} first, just in case.`);
    }

    // Drop any stale WAL/SHM sidecars for the current DB so they can't mix
    // with the restored file's data on next open
    for (const ext of ['-wal', '-shm']) {
        const sidecar = DB_PATH + ext;
        if (fs.existsSync(sidecar)) fs.unlinkSync(sidecar);
    }

    fs.copyFileSync(resolvedSrc, DB_PATH);
    console.log(`Restored ${resolvedSrc} -> ${DB_PATH}`);
    console.log('Now (re)start db_api/server.js to pick up the restored data.');
}

async function main() {
    const [, , cmd, arg] = process.argv;

    switch (cmd) {
        case 'backup':
            await backup(arg);
            break;
        case 'restore':
            restore(arg);
            break;
        default:
            console.log(
                `Usage:
  node dbBackup.js backup [outputPath]    Create a WAL-safe backup (default: db_api/backups/players-<timestamp>.db)
  node dbBackup.js restore <backupPath>   Restore players.db from a backup (stop server.js first!)`
            );
    }
}

main();

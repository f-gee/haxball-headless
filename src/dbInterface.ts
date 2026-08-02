import { StoredPlayer } from "./PlayerManager";

type GetPlayerResult =
    | { ok: true; player: StoredPlayer }
    | { ok: false; error: string };

type UpdatePlayerResult =
    | { ok: true; player: StoredPlayer }
    | { ok: false; error: string };

type BatchUpdatePlayersResult =
    | { ok: true; updatedCount: number; players: StoredPlayer[]; skipped?: { playerData: Partial<StoredPlayer>; reason: string }[] }
    | { ok: false; error: string };

type TopPlayersBy = 'elo' | 'winrate';

type TopPlayersResult =
    | { ok: true; players: (StoredPlayer & { winRate?: number })[] }
    | { ok: false; error: string };

type PlayerUpdate = Pick<StoredPlayer, 'name' | 'auth' | 'elo' | 'totalGames' | 'totalWins' | 'lastActivity'>;

const queuedUpdates: Map<string, PlayerUpdate> = new Map();

export const dbInterface = {
    async getPlayer(auth: string): Promise<GetPlayerResult> {
        if (!process.env.DB_API_URL) {
            return { ok: false, error: 'no DB API URL' };
        }

        try {
            const res = await fetch(`${process.env.DB_API_URL}/getPlayer`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ auth }),
            });

            if (res.status === 404) {
                return { ok: false, error: `player not found: ${auth}` };
            }

            if (!res.ok) {
                return { ok: false, error: `getPlayer failed: ${res.status} ${res.statusText}` };
            }

            const player: StoredPlayer = await res.json();
            return { ok: true, player };
        } catch (err) {
            return { ok: false, error: `getPlayer request error: ${(err as Error).message}` };
        }
    },

    async updatePlayer(auth: string, player: Partial<StoredPlayer>): Promise<UpdatePlayerResult> {
        if (!process.env.DB_API_URL) {
            return { ok: false, error: 'no DB API URL' };
        }

        try {
            const playerData = { name: player.name, elo: player.elo, lastActivity: player.lastActivity, totalGames: player.totalGames, totalWins: player.totalWins };
            const res = await fetch(`${process.env.DB_API_URL}/updatePlayer`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ auth, playerData }),
            });

            if (!res.ok) {
                const body = await res.json().catch(() => null);
                return { ok: false, error: `updatePlayer failed: ${res.status} ${res.statusText}${body?.error ? ` — ${body.error}` : ''}` };
            }

            const updatedPlayer: StoredPlayer = await res.json();
            return { ok: true, player: updatedPlayer };
        } catch (err) {
            return { ok: false, error: `updatePlayer request error: ${(err as Error).message}` };
        }
    },

    async batchUpdatePlayers(playersDataArray: Partial<StoredPlayer>[]): Promise<BatchUpdatePlayersResult> {
        if (!process.env.DB_API_URL) {
            return { ok: false, error: 'no DB API URL' };
        }

        try {
            const res = await fetch(`${process.env.DB_API_URL}/batchUpdatePlayers`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ playersDataArray }),
            });

            if (!res.ok) {
                return { ok: false, error: `batchUpdatePlayers failed: ${res.status} ${res.statusText}` };
            }

            const data: { updatedCount: number; players: StoredPlayer[]; skipped?: { playerData: Partial<StoredPlayer>; reason: string }[] } = await res.json();
            return { ok: true, updatedCount: data.updatedCount, players: data.players, skipped: data.skipped };
        } catch (err) {
            return { ok: false, error: `batchUpdatePlayers request error: ${(err as Error).message}` };
        }
    },

    // by='elo'     -> top N players sorted by elo descending
    // by='winrate' -> top N players sorted by totalWins/totalGames descending,
    //                 restricted to players with at least `minGames` games so a
    //                 1-win-1-game player can't top the board
    async getTopPlayers(by: TopPlayersBy = 'elo', limit = 10, minGames = 10): Promise<TopPlayersResult> {
        if (!process.env.DB_API_URL) {
            return { ok: false, error: 'no DB API URL' };
        }

        try {
            const params = new URLSearchParams({ by, limit: String(limit) });
            if (by === 'winrate') params.set('minGames', String(minGames));

            const res = await fetch(`${process.env.DB_API_URL}/topPlayers?${params.toString()}`);

            if (!res.ok) {
                return { ok: false, error: `getTopPlayers failed: ${res.status} ${res.statusText}` };
            }

            const players: (StoredPlayer & { winRate?: number })[] = await res.json();
            return { ok: true, players };
        } catch (err) {
            return { ok: false, error: `getTopPlayers request error: ${(err as Error).message}` };
        }
    },

    queueUpdate(player: StoredPlayer) {
        const update: PlayerUpdate = {
            name: player.name,
            auth: player.auth,
            elo: player.elo,
            totalGames: player.totalGames,
            totalWins: player.totalWins,
            lastActivity: player.lastActivity,
        };
        const existingUpdate = queuedUpdates.get(player.auth);
        if (existingUpdate) {
            queuedUpdates.set(player.auth, {
                ...existingUpdate,
                ...update,
                lastActivity: existingUpdate.lastActivity || update.lastActivity,
            });
        } else {
            queuedUpdates.set(player.auth, update);
        }
    },

    flushQueue() {
        const updatesToSend: Partial<StoredPlayer>[] = [...queuedUpdates.values()];

        // Clear queue immediately to prevent race conditions
        queuedUpdates.clear();

        this.batchUpdatePlayers(updatesToSend)
            .then((result) => {
                if (!result.ok) {
                    console.error(`[DB] Failed to flush ${updatesToSend.length} queued updates: ${result.error}`);
                    return;
                }
                if (result.skipped?.length) {
                    console.warn(`[DB] Flushed ${result.updatedCount}/${updatesToSend.length} queued updates — ${result.skipped.length} skipped:`, result.skipped);
                    return;
                }
                console.log(`[DB] Flushed ${result.updatedCount} queued updates successfully`);
            })
            .catch((error) => {
                // Should be unreachable since batchUpdatePlayers catches internally,
                // but kept as a safety net.
                console.error(`[DB] Unexpected error flushing queued updates:`, error);
            });
    },
};
import { StoredPlayer } from "./PlayerManager";

type GetPlayerResult =
    | { ok: true; player: StoredPlayer }
    | { ok: false; error: string };

type UpdatePlayerResult =
    | { ok: true; player: StoredPlayer }
    | { ok: false; error: string };

type BatchUpdatePlayersResult =
    | { ok: true; updatedCount: number; players: StoredPlayer[] }
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
                return { ok: false, error: `updatePlayer failed: ${res.status} ${res.statusText}` };
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

            const data: { updatedCount: number; players: StoredPlayer[] } = await res.json();
            return { ok: true, updatedCount: data.updatedCount, players: data.players };
        } catch (err) {
            return { ok: false, error: `batchUpdatePlayers request error: ${(err as Error).message}` };
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
        // console.log(`[DB] Queued update for player: ${player.name}, ${player.auth}`);
        // console.log(JSON.stringify([...queuedUpdates]));
    },

    flushQueue() {
        const updatesToSend: Partial<StoredPlayer>[] = [];

        // Collect all queued updates
        for (const playerData of queuedUpdates.values()) {
            updatesToSend.push(playerData);
        }

        // Clear queue immediately to prevent race conditions
        queuedUpdates.clear();

        // Send all updates in one batch request
        this.batchUpdatePlayers(updatesToSend)
            .then(() => {
                console.log(`[DB] Flushed ${updatesToSend.length} queued updates successfully`);
            })
            .catch((error) => {
                console.error(`[DB] Failed to flush queued updates:`, error);

                // // Put updates back in queue if batch update failed
                // updatesToSend.forEach(playerData => {
                //     if (playerData.auth) {
                //         this.queueUpdate(playerData as StoredPlayer);
                //     }
                // });
            });
    },
};
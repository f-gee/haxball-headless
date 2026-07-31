import { util } from "./util";
import { gameManager, room } from "./GameManager";
import { dbInterface } from "./databaseInterface";
import { ENV } from "./env_handler";
export interface Player {
    id: number;
    name: string;
    team: number;
    isAfk: boolean;
    isAdmin: boolean;
    isSuperAdmin: boolean;
    isDeveloper: boolean;
    isVip: boolean;
    commandCooldowns: Map<string, number>;
    conn: string;
    auth: string;
    elo: number;
    lastActivity: Date;
    spectatingSince: Date;
    restoreTeam: number;
    commandCooldownUntil: Date;
    chatMutedUntil: Date;
    chatLastTimestamp: Date;
    chatSpamTickets: number;
    afkGamesCount: number;
    totalGames: number;
    totalWins: number;
}

export interface StoredPlayer {
    name: string;
    auth: string;
    elo: number;
    lastActivity: Date;
    chatMutedUntil: Date;
    totalGames: number;
    totalWins: number;
}

export interface VanillaPlayer {
    id: number;
    name: string;
    team: number;
    admin: boolean;
    conn: string;
    auth: string;
}

class PlayerManager {
    public all = new Map<number, Player>();
    public afks = new Set<Player>();
    public spectators = new Set<Player>();
    public activeSpectators = new Set<Player>();
    public red = new Set<Player>();
    public blue = new Set<Player>();
    public admins = new Set<Player>();
    public superAdmins = new Set<Player>();
    public developers = new Set<Player>();

    public setVip(player: Player, isVip: boolean) {
        player.isVip = isVip;
        util.messageDevelopers(`${player.name} is ${isVip ? "now" : "no longer"} a vip`);
    }
    private setFlag(player: Player, flagKey: "isAdmin" | "isSuperAdmin" | "isDeveloper", targetSet: Set<Player>, value: boolean) {
        if (!player) return;

        player[flagKey] = value;
        if (value) targetSet.add(player);
        else targetSet.delete(player);
    }

    public setAdmin(player: Player, isAdmin: boolean) {
        this.setFlag(player, "isAdmin", this.admins, isAdmin);
        if (!isAdmin) {
            if (player.isSuperAdmin) this.setFlag(player, "isSuperAdmin", this.superAdmins, false);
            if (player.isDeveloper) this.setFlag(player, "isDeveloper", this.developers, false);
        }
        util.messageAdmins(`${player.name} is ${isAdmin ? "now" : "no longer"} admin`);
    }
    public setSuperAdmin(player: Player, isSuperAdmin: boolean) {
        if (isSuperAdmin && !player.isAdmin) {
            this.setFlag(player, "isAdmin", this.admins, true);
        }
        else if (!isSuperAdmin && player.isDeveloper) {
            this.setFlag(player, "isDeveloper", this.developers, false);
        }
        this.setFlag(player, "isSuperAdmin", this.superAdmins, isSuperAdmin);
        player.commandCooldowns.clear();
        util.messageSuperAdmins(`${player.name} is ${isSuperAdmin ? "now" : "no longer"} a super admin`);
    }
    public setDeveloper(player: Player, isDeveloper: boolean) {
        if (isDeveloper) {
            if (!player.isAdmin) {
                this.setFlag(player, "isAdmin", this.admins, true);
            }
            if (!player.isSuperAdmin) {
                this.setFlag(player, "isSuperAdmin", this.superAdmins, true);
            }
        }
        // else if (!isDeveloper && player.isSuperAdmin) {
        //     this.setFlag(player, "isSuperAdmin", this.superAdmins, false);
        // }
        player.commandCooldowns.clear();
        this.setFlag(player, "isDeveloper", this.developers, isDeveloper);
        util.messageDevelopers(`${player.name} is ${isDeveloper ? "now" : "no longer"} a developer`);
    }

    private addToTeamSet(player: Player, team: number) {
        if (team === 0) {
            this.spectators.add(player);
            if (player.isAfk) this.afks.add(player);
            else this.activeSpectators.add(player);
        }
        else if (team === 1) this.red.add(player);
        else if (team === 2) this.blue.add(player);
    }
    private removeFromTeamSet(player: Player, team: number) {
        if (team === 0) {
            this.spectators.delete(player);
            this.activeSpectators.delete(player);
            this.afks.delete(player);
        } else {
            if (team === 1) this.red.delete(player);
            if (team === 2) this.blue.delete(player);

        }
    }

    public addPlayer(player: Player) {
        player.lastActivity = new Date();
        this.all.set(player.id, player);
        this.addToTeamSet(player, player.team);
        // if (player.isAdmin) this.admins.add(player);
        // if (player.isSuperAdmin) this.superAdmins.add(player);
        // if (player.isDeveloper) this.developers.add(player);
        if (ENV.DB_API_URL) {
            dbInterface.getPlayer(player.auth).then(result => {
                if (!result.ok) {
                    //console.warn(result.error);
                    return;
                }
                player.elo = result.player.elo;
                player.totalGames = result.player.totalGames;
                player.totalWins = result.player.totalWins;

                util.pm(player, `Welcome back, ${player.name}! Elo: ${player.elo}`, "whisper");
            });
        }
    }

    public removePlayer(playerId: number) {
        const player = this.all.get(playerId);
        if (!player) return;

        player.lastActivity = new Date();

        if (gameManager.isGameRanked && gameManager.isGameGoingOn && player.team > 0) {
            player.elo -= 20;
            util.say(`⚠️ ${player.name} devam eden maçtan ayrıldığı için 20 Elo puanı silindi. Yeni puanı: ${player.elo}`);
            gameManager.isGameRanked = false;
            util.messageAdmins(`Başlangıç kadroları bozuldu. Puanlar kaydedilmeyecek`);
            //also reward opposite team elo..
            const winnerGainElo = 5;
            for (const _p of playerManager[player.team === 1 ? "blue" : "red"]) {
                _p.elo += winnerGainElo;
                util.pm(_p, `${player.name} devam eden maçtan ayrıldığı için ${winnerGainElo} Elo puanı kazandınız. Yeni puanınız: ${_p.elo}`, "info");
            }
        }

        if (ENV.DB_API_URL) {
            //dbInterface.queueUpdate(player);
            // do not queue, update instantly
            dbInterface.updatePlayer(player.auth, { elo: player.elo }).catch(err => {
                console.error('updatePlayer failed:', err);
            });
        }

        this.removeFromTeamSet(player, player.team);
        this.admins.delete(player);
        this.superAdmins.delete(player);
        this.developers.delete(player);
        this.all.delete(playerId);
    }

    public handleTeamChange(player: Player, newTeam: number) {
        this.removeFromTeamSet(player, player.team);
        player.team = newTeam;
        this.addToTeamSet(player, newTeam);
    }
    public async movePlayerToTeam(player: Player, newTeam: number) {
        const oldTeam = player.team;
        if (newTeam === 0) {
            player.spectatingSince = new Date();
        }
        if (oldTeam === newTeam) { return }
        this.handleTeamChange(player, newTeam);
        await room.setPlayerTeam(player.id, newTeam);
    }
    public async setAfk(player: Player, isAfk: boolean) {
        player.lastActivity = new Date();
        player.isAfk = isAfk;
        if (isAfk) {
            this.afks.add(player);
            this.activeSpectators.delete(player);
        } else {
            this.afks.delete(player);
            this.activeSpectators.add(player);
        }
        await playerManager.movePlayerToTeam(player, 0);

        if (isAfk && gameManager.isGameRanked && gameManager.isGameGoingOn && player.team % 3 !== 0) {
            player.elo -= 20;
            util.say(`⚠️ ${player.name} devam eden maçtan ayrıldığı için 20 Elo puanı silindi. Yeni puanı: ${player.elo}`);
            gameManager.isGameRanked = false;
            util.messageAdmins(`Başlangıç kadroları bozuldu. Puanlar kaydedilmeyecek`);
            //also reward opposite team elo..
            const winnerGainElo = 5;
            for (const _p of playerManager[player.team === 1 ? "blue" : "red"]) {
                _p.elo += winnerGainElo;
                util.pm(_p, `${player.name} devam eden maçtan ayrıldığı için ${winnerGainElo} Elo puanı kazandınız. Yeni puanınız: ${_p.elo}`, "info");
                if (ENV.DB_API_URL) {
                    dbInterface.updatePlayer(player.auth, { elo: player.elo }).catch(err => {
                        console.error('updatePlayer failed:', err);
                    });
                }
            }
        }

    }
    public getByQuery(query: string): Player | null {
        const lower = query.toLocaleLowerCase();

        // 1) exact ID match (fastest)
        if (query.startsWith("#")) {
            const id = parseInt(query.slice(1));
            return this.all.get(id) || null;
        }

        // 2) exact name match
        for (const p of this.all.values()) {
            if (p.name.toLocaleLowerCase() === lower) return p;
        }

        // 3) includes name match
        for (const p of this.all.values()) {
            if (p.name.toLocaleLowerCase().includes(lower)) return p;
        }

        return null; // not found
    }
    public saveRecentPlayer(player: Player) {
        const findRecentPlayer = gameManager.recentPlayers.find(x => x.auth === player.auth);
        if (findRecentPlayer) {
            findRecentPlayer.name = player.name;
            findRecentPlayer.elo = player.elo;
            findRecentPlayer.lastActivity = new Date();
            findRecentPlayer.chatMutedUntil = player.chatMutedUntil;
            findRecentPlayer.totalGames = player.totalGames;
            findRecentPlayer.totalWins = player.totalWins;
        } else {
            const recentPlayer: StoredPlayer = {
                name: player.name,
                auth: player.auth,
                elo: player.elo,
                lastActivity: player.lastActivity,
                chatMutedUntil: player.chatMutedUntil,
                totalGames: player.totalGames,
                totalWins: player.totalWins,
            }
            gameManager.recentPlayers.push(recentPlayer);
            gameManager.recentPlayers = gameManager.recentPlayers.sort((a, b) => b.lastActivity.getTime() - a.lastActivity.getTime());
            if (gameManager.recentPlayers.length > 50) {
                gameManager.recentPlayers.pop();
            }
        }
    }
    public restoreRecentPlayer(player: Player) {
        const findRecentPlayer = gameManager.recentPlayers.find(x => x.auth === player.auth);
        if (findRecentPlayer) {
            player.elo = findRecentPlayer.elo;
            player.chatMutedUntil = findRecentPlayer.chatMutedUntil;
            player.totalGames = findRecentPlayer.totalGames;
            player.totalWins = findRecentPlayer.totalWins;
            const minutesSinceLastSeen = Math.ceil((Date.now() - findRecentPlayer.lastActivity.getTime()) / 60000);
            util.messageAdmins(`${player.name} was last seen ${minutesSinceLastSeen} minutes ago`);
            if (findRecentPlayer.name !== player.name) {
                util.messageAdmins(`${player.name}'s old name was ${findRecentPlayer.name}`);
            }
        }
    }
}
export const playerManager = new PlayerManager();
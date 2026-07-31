import { room, gameManager } from './GameManager';
import { commandManager } from './CommandManager';
import { VanillaPlayer, Player, playerManager } from './PlayerManager';
import { balancing } from "./balancing";
import { util } from "./util";

room.setDefaultStadium("Hockey");
room.startGame();
room.setTeamsLock(true);
room.setScoreLimit(3);
room.setTimeLimit(5);

if (process.env.NODE_ENV !== "production") {
    Object.assign(globalThis, { playerManager, commandManager, debugLog: util.debugLog, room });
}

// ********************* Room events *********************
room.onGamePause = (byPlayer: VanillaPlayer) => {
    if (byPlayer) {
        util.pm(byPlayer, `Oyun 30 saniye sonra devam edecek`, "info");
        gameManager.timers.unpauseTimer = setTimeout(() => { gameManager.pauseTheGame(false); }, 30000);
    }
    gameManager.isGamePaused = true;
    // if (gameManager.isTrackingAFKs) {
    //     clearInterval(gameManager.timers.AfkTrackingInterval);
    // }
};

room.onGameUnpause = (byPlayer: VanillaPlayer) => {
    gameManager.isGamePaused = false;
    if (byPlayer) {
        //clearTimeout(data.miscStuff.unpauseTimer);
        //data.miscStuff.manualUnpauseTimer = null;
        if (gameManager.timers.unpauseTimer) clearTimeout(gameManager.timers.unpauseTimer);
        gameManager.timers.unpauseTimer = null;
    }
    // if (gameManager.isTrackingAFKs) {
    //     util.resetAFKChecks();
    //     gameManager.timers.afkTrackingInterval = setInterval(util.checkAFKs, 5000);
    // }
};

room.onTeamGoal = async (teamId: 1 | 2) => {
    gameManager.nextKickOffTeamId = 3 - teamId;
    //await playerStorage.batchUpdatePlayers();
}
room.onPlayerTeamChange = async (player_vanilla: VanillaPlayer, byPlayer_vanilla: VanillaPlayer) => {
    const player = playerManager.all.get(player_vanilla.id);
    if (!player) {
        //should not happen
        return
    }
    player.lastActivity = new Date();
    if (!byPlayer_vanilla) {
        return
    }
    const byPlayer = playerManager.all.get(byPlayer_vanilla.id);
    if (!byPlayer) {
        //should not happen
        return;
    }
    byPlayer.lastActivity = new Date(); // just to make sure admins are not AFK'd often
    if (gameManager.timers.balanceTimer) {
        clearTimeout(gameManager.timers.balanceTimer);
        gameManager.timers.balanceTimer = null;
    }
    //let didSpectatingSinceChange = false;
    if (player_vanilla.team > 0) {
        // check AFK
        if (player.isAfk) {
            await room.setPlayerTeam(player.id, 0);
            util.pm(byPlayer, `${player.name} AFK!`, "error");
            return
        }
    } else {
        player.spectatingSince = new Date();
    }
    playerManager.handleTeamChange(player, player_vanilla.team);
    if (byPlayer && player_vanilla.team === 0) {
        await balancing.reorderSpecs();
    }
    await balancing.balanceTeamsWithTimeout(2000);
};

room.onGameStart = async (byPlayer: VanillaPlayer) => {
    gameManager.nextKickOffTeamId = 1;
    if (gameManager.timers.startTimer) clearTimeout(gameManager.timers.startTimer);
    gameManager.timers.startTimer = null;
    gameManager.isGameGoingOn = true;

    // check if game is eligible for ranking (elo):
    {
        const teamCaps = gameManager.teamCaps;
        const vanillaGPL = await room.getPlayerList();
        gameManager.isGameRanked = teamCaps.red === teamCaps.blue && teamCaps.red === playerManager.red.size && teamCaps.blue === playerManager.blue.size;
        if (gameManager.isGameRanked) {
            util.messageAdmins(`Maç ${teamCaps.red}v${teamCaps.blue}. Puanlar kaydediliyor`);
        } else {
            util.messageAdmins(`Maç ${teamCaps.red}v${teamCaps.blue} değil. Puanlar kaydedilmeyecek`);
        }
    }

    // if (gameManager.isTrackingAFKs) {
    //     util.resetAFKChecks();
    //     gameManager.timers.afkTrackingInterval = setInterval(util.checkAFKs, 5000);
    // }
};

room.onGameStop = async (byPlayer: VanillaPlayer) => {
    gameManager.nextKickOffTeamId = 1;
    gameManager.isGameGoingOn = false;
    if (byPlayer) {
        gameManager.gameEndAutoStart = false;
        if (gameManager.timers.startTimer) clearTimeout(gameManager.timers.startTimer);
        gameManager.timers.startTimer = null;
        util.say(`Game will start in 30 seconds`);
        gameManager.timers.startTimer = setTimeout(room.startGame, 30000);
    }
    if (gameManager.captainMode) {
        balancing.clearCaptainPrompt();
        gameManager.lastTeamThatPicked = 2;
    }
    await balancing.balanceTeamsWithTimeout(2000);
    // if (gameManager.isTrackingAFKs) {
    //     clearInterval(gameManager.timers.AfkTrackingInterval);
    // }
    //await playerStorage.batchUpdatePlayers();
};
room.onTeamVictory = async (_scores: { red: number, blue: number }) => {
    //util.debugLog("onTeamVictory");
    room.stopGame();
    if (gameManager.timers.startTimer) clearTimeout(gameManager.timers.startTimer);
    gameManager.timers.startTimer = null;
    // if (gameManager.isTrackingAFKs) {
    // 	clearInterval(gameManager.timers.AfkTrackingInterval);
    // }
    await balancing.endGame(_scores);
    if (!gameManager.captainMode) {
        const nSeconds = (gameManager.mixMode === "None") ? 60 : 5;
        //util.say(`Yeni oyun ${nSeconds} saniye sonra başlayacak`);
        gameManager.timers.startTimer = setTimeout(room.startGame, nSeconds * 1000);
    }
};

room.onPlayerJoin = async (vanillaPlayer: VanillaPlayer) => {
    if (!util.validatePlayer(vanillaPlayer)) {
        return;
    }
    const now = new Date();
    const player: Player = {
        id: vanillaPlayer.id,
        name: vanillaPlayer.name,
        team: vanillaPlayer.team,
        isAfk: false,
        isAdmin: false,
        isSuperAdmin: false,
        isDeveloper: false,
        isVip: false,
        commandCooldowns: new Map(),
        conn: vanillaPlayer.conn,
        auth: vanillaPlayer.auth,
        elo: 1600,
        lastActivity: now,
        spectatingSince: now,
        restoreTeam: 0,
        commandCooldownUntil: now,
        chatMutedUntil: now,
        chatLastTimestamp: now,
        chatSpamTickets: 0,
        afkGamesCount: 0,
        totalGames: 0,
        totalWins: 0
    };
    playerManager.addPlayer(player);
    const foundAdmin = gameManager.savedAdminAuths.data.find((a: { auth: string; }) => a.auth === vanillaPlayer.auth);
    if (foundAdmin) {
        if (foundAdmin.level === "developer") {
            playerManager.setDeveloper(player, true);
        } else if (foundAdmin.level === "superAdmin") {
            playerManager.setSuperAdmin(player, true);
        } else {
            playerManager.setAdmin(player, true);
        }
    }
    if (gameManager.stadiums.currentStadiumMessage && gameManager.stadiums.currentStadiumMessage.length) {
        util.pm(player, `${player.name}, map info: ${gameManager.stadiums.currentStadiumMessage}`);
    }
    if (gameManager.welcomeMessage && gameManager.welcomeMessage.length) {
        util.pm(player, `${gameManager.welcomeMessage}`, "info");
        util.messageDevelopers(`Sent welcome message: ${gameManager.welcomeMessage}`);
    }
    util.setAutoCapacityPassword();
    playerManager.restoreRecentPlayer(player);
    await balancing.balanceTeamsWithTimeout(1000);
};
room.onPlayerLeave = async (vanillaPlayer: VanillaPlayer) => {
    const player = playerManager.all.get(vanillaPlayer.id);
    if (!player) return;
    playerManager.saveRecentPlayer(player);
    playerManager.removePlayer(vanillaPlayer.id);
    util.setAutoCapacityPassword();
    await balancing.balanceTeamsWithTimeout(1000);
};
room.onPlayerKicked = (vanillaPlayer: VanillaPlayer, reason: string, ban: boolean, byPlayer?: any) => {
    if (!byPlayer) { byPlayer = { id: 0, name: "bot" } }
    if (ban) {
        reason = "" + reason;
        gameManager.recentBans.push({ id: vanillaPlayer.id, name: vanillaPlayer.name, reason: reason, by_name: byPlayer.name });
        if (gameManager.recentBans.length > 30) { gameManager.recentBans.splice(0, 1) }
        util.messageAdmins(`${vanillaPlayer.name} was kicked by ${byPlayer.name} (Reason: ${reason})`);
        util.messageAdmins(`To remove ban: .clearban ${vanillaPlayer.id}`);
    }
};
room.onPlayerChat = (vanillaPlayer: VanillaPlayer, message: string) => {
    const player = playerManager.all.get(vanillaPlayer.id);
    if (!player) {
        //util.debugLog(`onPlayerChat: player not found for player ${vanillaPlayer.name} #${vanillaPlayer.id}`);
        return;
    }
    if (gameManager.isCaptainPickingActive) {
        if (player.id === gameManager.captainPromptObj.captainId) {
            balancing.captainHandleChoice(player, message);
        }
    }
    if (!util.checkSpam(player, message)) {
        return false
    };
    if (message.startsWith(".") || message.startsWith("!")) {
        commandManager.parseAndExecuteCommand(player, message);
        return false;
    }

    if (gameManager.isCachingChat) {
        gameManager.chatCache.push(`${player.name}: ${message}`);
        if (gameManager.chatCache.length > gameManager.chatCacheLimit) {
            util.geminiAnalyzeChat(gameManager.chatCache);
            gameManager.chatCache = [];
        }
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    fetch(process.env.DISCORD_CHATLOGS_URL, {
        method: "POST",
        signal: controller.signal,
        body: JSON.stringify({ "content": `**${player.name}:** ${message.replaceAll("@", "[@]")}` }),
        headers: { "Content-Type": "application/json", },
    })
        .catch((err) => {
            util.debugLog("Discord chatlog failed: " + (err as Error).message);
        })
        .finally(() => {
            clearTimeout(timeout);
        });
};// onPlayerChat

room.onRoomLink = async (url: string) => {
    try {
        console.log("onRoomLink: " + url);
        //console.log("room at export time:", typeof room, room);
        //console.log("util at export time:", typeof util, util);
        if (process.env.HAXBALL_PLATFORM === "node") {
            hjsCallback({ room, util, gameManager, playerManager, commandManager, url });
        }
        await fetch(process.env.DISCORD_ROOMSTATUS_URL, {
            method: "PATCH",
            body: JSON.stringify({
                "embeds": [
                    {
                        "title": gameManager.roomParams.roomName || "room name",
                        "description": "haxball room is up",
                        "color": 0x92FF0E,
                        "footer": {
                            "text": `bot v${__BOT_VERSION__} / ${gameManager.roomParams.public ? 'public' : 'private'} / ${gameManager.roomParams.maxPlayers}p`,
                            "icon_url": process.env.DISCORD_ICON_URL,
                        },
                        "url": url,
                        "timestamp": new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString().replace("Z", "+03:00")
                    }
                ]
            }),
            headers: {
                "Content-Type": "application/json",
            },
        });
        if (process.env.NODE_ENV === "development" && process.env.HAXBALL_PLATFORM === "browser") {
            window.open(url, '_blank')?.focus();
        }
    } catch (e) {
        util.debugLog(e);
    }
};

//export gameManager;
export { room, gameManager, commandManager, playerManager, util, balancing };
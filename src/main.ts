import { room, gameManager } from './GameManager';
import { commandManager } from './CommandManager';
import { VanillaPlayer, Player, playerManager } from './PlayerManager';
import * as util from './util';
import * as balancing from './balancing';

room.setDefaultStadium("Hockey");
room.startGame();
room.setTeamsLock(true);
room.setScoreLimit(3);
room.setTimeLimit(5);

if (process.env.NODE_ENV !== "production") {
    Object.assign(globalThis, { playerManager, commandManager, debugLog: util.debugLog, room });
}

// ********************* Room events *********************
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
    if (gameManager.timers.balanceTimer) {
        clearTimeout(gameManager.timers.balanceTimer);
        gameManager.timers.balanceTimer = null;
    }
    //let didSpectatingSinceChange = false;
    if (player_vanilla.team > 0) {
        // check AFK
        if (player.isAfk) {
            await room.setPlayerTeam(player.id, 0);
            return util.pm(byPlayer, `${player.name} AFK!`, "error");
        }
    } else {
        player.spectatingSince = new Date();
    }
    await playerManager.handleTeamChange(player, player_vanilla.team);
    if (byPlayer && player_vanilla.team === 0) {
        await balancing.reorderSpecs();
    }
    await balancing.balanceTeamsWithTimeout(2000);
};

room.onPlayerJoin = async (vanillaPlayer: VanillaPlayer) => {
    if (!util.validatePlayer(vanillaPlayer)) {
        return;
    }
    const now = new Date();
    const player: Player = {
        team: vanillaPlayer.team,
        isAfk: false,
        isAdmin: false,
        isSuperAdmin: false,
        isDeveloper: true,
        isVip: false,
        id: vanillaPlayer.id,
        name: vanillaPlayer.name,
        conn: vanillaPlayer.conn,
        auth: vanillaPlayer.auth,
        elo: 1600,
        lastActivity: now,
        spectatingSince: now,
        restoreTeam: 0,
        commandCooldownUntil: now,
        chatMutedUntil: now,
        chatLastTimestamp: now,
        chatSpamTickets: 0
    };
    playerManager.addPlayer(player);
    room.sendAnnouncement(`Hello ${vanillaPlayer.name}`);
    room.setPlayerAdmin(vanillaPlayer.id, true);
    playerManager.setDeveloper(player, true);
    await balancing.balanceTeamsWithTimeout(1000);
};
room.onPlayerLeave = async (vanillaPlayer: VanillaPlayer) => {
    playerManager.removePlayer(vanillaPlayer.id);
    await balancing.balanceTeamsWithTimeout(1000);
};
room.onPlayerChat = (vanillaPlayer: VanillaPlayer, message: string) => {
    const player = playerManager.all.get(vanillaPlayer.id);
    if (!player) {
        //util.debugLog(`onPlayerChat: player not found for player ${vanillaPlayer.name} #${vanillaPlayer.id}`);
        return;
    }
    if (!util.checkSpam(player, message)) {
        return false
    };
    if (message.startsWith(".") || message.startsWith("!")) {
        commandManager.parseAndExecuteCommand(player, message);
        return false;
    }

    fetch(process.env.DISCORD_CHATLOGS_URL, {
        method: "POST",
        body: JSON.stringify({ "content": `**${player.name}:** ${message.replaceAll("@", "[@]")}` }),
        headers: { "Content-Type": "application/json", },
    });
};// onPlayerChat

room.onRoomLink = async (url: string) => {
    try {
        console.log("onRoomLink");
        await fetch(process.env.DISCORD_ROOMSTATUS_URL, {
            method: "PATCH",
            body: JSON.stringify({
                "embeds": [
                    {
                        "title": gameManager.roomParams.roomName || "room name",
                        "description": "created haxball room.",
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
        window.open(url, '_blank')?.focus();
    } catch (e) {
        util.debugLog(e);
    }
};

//export gameManager;
export { room, gameManager, commandManager, playerManager, util, balancing };
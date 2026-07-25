import { gameManager } from './GameManager';
import { commandManager } from './CommandManager';
import { playerManager } from './PlayerManager';
import { VanillaPlayer } from './types';
import * as util from './util';

//gameManager.token = "thr1.AAAAAGpk54NSo_3XDm5LKQ.iziU1vrzhVs";
//const room = HBInit(gameManager.roomParams);
const room = gameManager.createRoom({ token: "thr1.AAAAAGpk54NSo_3XDm5LKQ.iziU1vrzhVs" });
room.setDefaultStadium("Hockey");
room.startGame();
room.setTeamsLock(true);
room.setScoreLimit(3);
room.setTimeLimit(5);

if (process.env.NODE_ENV !== "production") {
    Object.assign(globalThis, { playerManager, commandManager, debugLog: util.debugLog, room });
}

room.onPlayerJoin = (player: VanillaPlayer) => {
    playerManager.addPlayer({
        team: player.team,
        isAfk: false,
        isAdmin: false,
        isSuperAdmin: false,
        isDeveloper: true,
        id: player.id,
        name: player.name,
        elo: 1600,
        lastActivity: new Date()
    });
    room.sendAnnouncement(`Hello ${player.name}`);
    room.setPlayerAdmin(player.id, true);
};
room.onPlayerLeave = (player: VanillaPlayer) => {
    playerManager.removePlayer(player.id);
};
room.onPlayerChat = (vanillaPlayer: VanillaPlayer, message: string) => {
    const player = playerManager.all.get(vanillaPlayer.id);
    if (!player) {
        util.debugLog(`onPlayerChat: player not found for player ${vanillaPlayer.name} #${vanillaPlayer.id}`);
        return;
    }
    if (message.startsWith(".") || message.startsWith("!")) {
        commandManager.parseAndExecuteCommand(player, message.substring(1));
        return false;
    }

};// onPlayerChat

room.onRoomLink = (url: string) => {
    try {
        console.log("TMP, onRoomLink");
        window.open(url, '_blank')?.focus();
    } catch (e) { }
};

//export gameManager;
export { room, gameManager, commandManager, playerManager, util };
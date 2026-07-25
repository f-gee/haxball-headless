import { gameManager } from './GameManager';
import { commandManager } from './CommandManager';
import { playerManager } from './PlayerManager';
import { VanillaPlayer } from './types';
import * as util from './util';

//const gameManager = new GameManager("My Room", 12, false, "[[token]]");
const room = HBInit(gameManager.roomParams);
room.setDefaultStadium("Hockey");
room.startGame();
room.setTeamsLock(true);
room.setScoreLimit(3);
room.setTimeLimit(5);
// test
room.onPlayerJoin = (player: VanillaPlayer) => {
    playerManager.addPlayer({
        team: player.team,
        isAdmin: false,
        isSuperAdmin: false,
        isDeveloper: false,
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
        const parseResult = commandManager.parseCommand(player, message);
        if (parseResult.isCommandFound) {
            //parseResult.command?.execute(player, parseResult.args);
            commandManager.executeCommand(parseResult);
        }
    }
    const [cmd, ...args] = message.slice(1).split(" ");

    console.info(cmd, args);

    switch (cmd) {
        case "admin": {
            if (gameManager.adminPasswords.indexOf(args[0]) !== -1) {

            }
        } break;
    }

};

//export gameManager;
export { room };
export { gameManager };
export { commandManager };
export { playerManager };
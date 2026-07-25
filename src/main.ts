import { GameManager, gameManager } from './GameManager';
//import RoomManager from './RoomManager';
import { HaxballPlayer } from './types';

//const gameManager = new GameManager("My Room", 12, false, "[[token]]");
const room = HBInit(gameManager.roomParams);
room.setDefaultStadium("Hockey");
room.startGame();
room.setTeamsLock(true);
room.setScoreLimit(3);
room.setTimeLimit(5);
// test
room.onPlayerJoin = (player: HaxballPlayer) => {
    room.sendAnnouncement(`Hello ${player.name}`);
    room.setPlayerAdmin(player.id, true);
};

room.onPlayerChat = (player: HaxballPlayer, message: string) => {
    if (!(message.startsWith(".") || message.startsWith("!"))) return;
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
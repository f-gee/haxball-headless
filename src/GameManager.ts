import { Command } from "./commands";
import { Player } from "./types";

export class GameManager {
    public roomParams: object;
    public commands: Command[];
    public adminPasswords: string[];

    constructor(roomName: string = "Haxball Room", maxPlayers: number = 12, isPublic: boolean = false, token: string = "[[token]]") {
        this.roomParams = { roomName, maxPlayers, public: isPublic, noPlayer: true, token };
        this.adminPasswords = [];
        this.commands = [];
    }

    //     export function registerCommand(name: string, descriptions: string[], execute: (player: Player, args: string[]) => void) {
    // 	commands.push({ name, descriptions, execute });
    // }
    registerCommand(name: string, descriptions: string[], execute: (player: Player, args: string[]) => void) {
        this.commands.push({ name, descriptions, execute });
    }
    unregisterCommand(name: string) {
        this.commands = this.commands.filter(cmd => cmd.name !== name);
    }

}

export const gameManager = new GameManager("My Room", 12, false, "[[token]]");

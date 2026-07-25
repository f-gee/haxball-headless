import { Player } from "./types";

export class GameManager {
    public roomParams: object;
    public adminPasswords: string[];

    constructor(roomName: string = "Haxball Room", maxPlayers: number = 12, isPublic: boolean = false, token: string = "[[token]]") {
        this.roomParams = { roomName, maxPlayers, public: isPublic, noPlayer: true, token };
        this.adminPasswords = [];
    }
}

export const gameManager = new GameManager("My Room", 12, false, "[[token]]");

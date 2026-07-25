import { Player } from "./types";

export class GameManager {
    public roomParams: object;
    public adminPasswords: string[];
    public token: string;
    public playersPerTeam: number;
    public autoBalance: boolean;

    constructor(roomName: string = "Haxball Room", maxPlayers: number = 12, isPublic: boolean = false) {
        this.token = "[[token]]";
        this.playersPerTeam = 4;
        this.autoBalance = true;
        this.roomParams = { roomName, maxPlayers, public: isPublic, noPlayer: true, token: this.token };
        this.adminPasswords = [];
    }

    createRoom(extraParams: object = {}): any {
        Object.assign(this.roomParams, extraParams);
        const room = HBInit(this.roomParams);
        return room;
    }
}

export const gameManager = new GameManager("My Room", 12, false);

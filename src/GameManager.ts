import { Player } from "./types";

export class GameManager {
    public token: string;
    public roomParams: object;
    public adminPasswords: string[];
    public superAdminPasswords: string[];
    public developerPasswords: string[];
    public playersPerTeam: number;
    public autoBalance: boolean;
    public captainMode: boolean;

    constructor(roomName: string = "Haxball Room", maxPlayers: number = 12, isPublic: boolean = false) {
        this.token = "[[token]]";
        this.roomParams = { roomName, maxPlayers, public: isPublic, noPlayer: true, token: this.token };
        this.adminPasswords = ["attmin1", "attmin2"];
        this.superAdminPasswords = ["sa1", "sa2"];
        this.developerPasswords = ["dp1", "dp2"];
        this.playersPerTeam = 4;
        this.autoBalance = true;
        this.captainMode = false;
    }

    createRoom(extraParams: object = {}): any {
        Object.assign(this.roomParams, extraParams);
        const room = HBInit(this.roomParams);
        return room;
    }
}

export const gameManager = new GameManager("My Room", 12, false);

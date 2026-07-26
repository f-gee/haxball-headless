export class GameManager {
    public token: string = process.env.HB_TOKEN ?? "[[token]]";
    public roomParams: object;
    public adminPasswords: string[] = ["admin1", "admin2"];
    public superAdminPasswords: string[] = ["sa1", "sa2"];
    public developerPasswords: string[] = ["dp1", "dp2"];
    public teamCaps: { red: number, blue: number, spec: number } = { red: 4, blue: 4, spec: 99 };
    public autoBalance: boolean = true;
    public captainMode: boolean = false;
    public forceEqualTeams: boolean = false;
    public nextKickOffTeamId: 1 | 2 = 1;
    public isGamePaused: boolean = false;
    public isGameGoingOn: boolean = false;
    public gameEndAutoStart: boolean = false;

    public timers: {
        afkTimer: ReturnType<typeof setTimeout> | null;
        balanceTimer: ReturnType<typeof setTimeout> | null;
        startTimer: ReturnType<typeof setTimeout> | null;
        pendingPromise: Promise<void> | null;
        resolvePending: (() => void) | null;
    } = { afkTimer: null, balanceTimer: null, startTimer: null, pendingPromise: null, resolvePending: null }

    constructor(roomName: string = "Haxball Room", maxPlayers: number = 12, isPublic: boolean = false) {
        this.roomParams = { roomName, maxPlayers, public: isPublic, noPlayer: true, token: this.token };
    }

    createRoom(extraParams: object = {}): any {
        Object.assign(this.roomParams, extraParams);
        const room = HBInit(this.roomParams);
        return room;
    }
}

export const gameManager = new GameManager("My Room", 12, false);
//export const room = gameManager.createRoom({ token: "thr1.AAAAAGplNWKzi8IBjALfQA.NF8XCsCSbvY" });
export const room = gameManager.createRoom();

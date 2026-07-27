import * as util from "./util";

export class GameManager {
    public roomParams: any;
    public adminPasswords: string[] = ["admin1", "admin2"];
    public superAdminPasswords: string[] = ["sa1", "sa2"];
    public developerPasswords: string[] = ["dp1", "dp2"];
    public savedAdminAuths: { data: unknown, url: string } = { data: [], url: process.env.SAVED_ADMIN_AUTHS_URL };
    public stadiums: { data: unknown, url: string, currentStadiumMessage: string } = { data: [], url: process.env.STADIUMS_URL, currentStadiumMessage: "" };
    public kits: { data: unknown, url: string, selectedKitId: number } = { data: [], url: process.env.KITS_URL, selectedKitId: 0 };
    public blockNewTab: boolean = true;
    public teamCaps: { red: number, blue: number, spec: number } = { red: 4, blue: 4, spec: 99 };
    public autoBalance: boolean = true;
    public captainMode: boolean = false;
    public forceEqualTeams: boolean = false;
    public nextKickOffTeamId: 1 | 2 = 1;
    public isGamePaused: boolean = false;
    public isGameGoingOn: boolean = false;
    public gameEndAutoStart: boolean = false;
    public autoPasswordCapacity: number = 11;
    public roomPassword: string | null = null;

    public timers: {
        afkTimer: ReturnType<typeof setTimeout> | null;
        balanceTimer: ReturnType<typeof setTimeout> | null;
        startTimer: ReturnType<typeof setTimeout> | null;
        pendingPromise: Promise<void> | null;
        resolvePending: (() => void) | null;
    } = { afkTimer: null, balanceTimer: null, startTimer: null, pendingPromise: null, resolvePending: null }

    constructor(roomParams: any) {
        this.roomParams = roomParams;
    }

    createRoom(extraParams: any = {}): any {
        Object.assign(this.roomParams, extraParams);
        const token = extraParams.token || null;
        console.log(`calling HBInit with token: ${token}`);
        const room = HBInit(this.roomParams);
        return room;
    }
}
// roomName: string = "Haxball Room", maxPlayers: number = 12, isPublic: boolean = false
export const gameManager = new GameManager({ roomName: "Haxball Room", maxPlayers: 14, public: false, noPlayer: true });
util.fetchData(null, "admins");
util.fetchData(null, "stadiums");
util.fetchData(null, "kits");
//export const room = gameManager.createRoom({ token: "thr1.AAAAAGplNWKzi8IBjALfQA.NF8XCsCSbvY" });
const room = gameManager.createRoom(process.env.HAXBALL_ENV === "puppeteer" ? { token: (window as any).HB_TOKEN } : {});
export { room };

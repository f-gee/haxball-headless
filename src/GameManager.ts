import { balancing } from "./balancing";
import { playerManager } from "./PlayerManager";
import { util } from "./util";

interface SavedAdminData {
    level: string;
    description: string;
    auth: string;
}

export class GameManager {
    public roomParams: any;
    public adminPasswords: string[] = ["admin1", "admin2"];
    public superAdminPasswords: string[] = ["sa1", "sa2"];
    public developerPasswords: string[] = ["dp1", "dp2"];
    public savedAdminAuths: { data: SavedAdminData[], url: string } = { data: [], url: process.env.SAVED_ADMIN_AUTHS_URL };
    public stadiums: { data: unknown, url: string, currentStadiumMessage: string } = { data: [], url: process.env.STADIUMS_URL, currentStadiumMessage: "" };
    public kits: { data: unknown, url: string, selectedKitId: number } = { data: [], url: process.env.KITS_URL, selectedKitId: 0 };
    public blockNewTab: boolean = process.env.NODE_ENV === "development" ? false : true;
    public teamCaps: { red: number, blue: number, spec: number } = { red: 4, blue: 4, spec: 99 };
    public autoBalance: boolean = true;
    public forceEqualTeams: boolean = false;
    public mixMode: string = "WinnerStays";// "WinnerStays" | "WinnerStays_Random" | "FullRandom" | "None" = "WinnerStays";
    public victoryStreak: { red: number, blue: number } = { red: 0, blue: 0 };
    public maxVictoryStreak: number = 10;
    public isGameRanked: boolean = false;
    public nextKickOffTeamId: number = 1;
    public isGamePaused: boolean = false;
    public isGameGoingOn: boolean = false;
    public gameEndAutoStart: boolean = false;
    public autoPasswordCapacity: number = 11;
    public roomPassword: string | null = null;
    public captcha: boolean = false;
    public captainMode: boolean = true;
    public captainPromptObj: { teamId: number, captainId: number, secondsRemaining: number } = { teamId: 1, captainId: 0, secondsRemaining: 0 };
    public lastTeamThatPicked: number = 2;
    public isCaptainPickingActive: boolean = false;
    public recentBans: { id: number, name: string, reason: string, by_name: string }[] = [];

    public timers: {
        afkTimer: ReturnType<typeof setTimeout> | null;
        balanceTimer: ReturnType<typeof setTimeout> | null;
        startTimer: ReturnType<typeof setTimeout> | null;
        unpauseTimer: ReturnType<typeof setTimeout> | null;
        captainPickInterval: ReturnType<typeof setInterval> | null;
        pendingPromise: Promise<void> | null;
        resolvePending: (() => void) | null;
    } = { afkTimer: null, balanceTimer: null, captainPickInterval: null, startTimer: null, unpauseTimer: null, pendingPromise: null, resolvePending: null }

    constructor(roomParams: any) {
        console.log(`room is ${roomParams.public ? "public" : "private"}`);
        this.roomParams = roomParams;
    }

    createRoom(extraParams: any = {}): any {
        Object.assign(this.roomParams, extraParams);
        //const token = extraParams.token || null;
        let token = null;
        if (process.env.HAXBALL_ENV === "puppeteer") {
            token = (window as any).HB_TOKEN;
        } else if (process.env.HAXBALL_ENV === "browser") {
            token = process.env.DEV_HB_TOKEN;
        } else if (process.env.HAXBALL_ENV === "node") {
            token = hjsToken;
        }
        if (token) {
            this.roomParams.token = token;
        }
        if (process.env.HB_ROOM_GEO) {
            this.roomParams.geo = JSON.parse(process.env.HB_ROOM_GEO);
        }
        console.log(`calling HBInit with token: ${token}`);
        const room = HBInit(this.roomParams);
        return room;
    }

    async changeTeamCaps(red: number, blue: number) {
        const oldTeamCaps = { ...this.teamCaps };
        this.teamCaps.red = red;
        this.teamCaps.blue = blue;
        if (oldTeamCaps.red > red) {
            // spec surplus red players
            const surplusRedPlayers = util.getRandomFromSetMultiple(playerManager.red, oldTeamCaps.red - red);
            for (const player of surplusRedPlayers) {
                await playerManager.movePlayerToTeam(player, 0);
            }
        }
        if (oldTeamCaps.blue > blue) {
            // spec surplus blue players
            const surplusBluePlayers = util.getRandomFromSetMultiple(playerManager.blue, oldTeamCaps.blue - blue);
            for (const player of surplusBluePlayers) {
                await playerManager.movePlayerToTeam(player, 0);
            }
        }
        await balancing.balanceTeamsWithTimeout(1000);
        return `${red}v${blue}`;
    }
}
// roomName: string = "Haxball Room", maxPlayers: number = 12, isPublic: boolean = false
export const gameManager = new GameManager({ roomName: process.env.HB_ROOM_NAME || "Haxball Room", maxPlayers: 14, public: process.env.NODE_ENV === "development" ? false : true, noPlayer: true });
util.fetchData(null, "admins");
util.fetchData(null, "stadiums");
util.fetchData(null, "kits");
//export const room = gameManager.createRoom({ token: "thr1.AAAAAGplNWKzi8IBjALfQA.NF8XCsCSbvY" });
//const room = gameManager.createRoom((process.env.HAXBALL_ENV === "puppeteer" || process.env.HAXBALL_ENV === "browser") ? { token: (window as any).HB_TOKEN } : process.env.HAXBALL_ENV === "node" ? { token: process.env.DEV_HB_TOKEN } : {});
const room = gameManager.createRoom();
export { room };

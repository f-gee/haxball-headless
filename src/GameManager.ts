import { balancing } from "./balancing";
import { VanillaPlayer, playerManager, StoredPlayer } from "./PlayerManager";
import { util } from "./util";

interface SavedAdminData {
    level: string;
    description: string;
    auth: string;
}
interface Stadium {
    name: string;
    m: string; // stadium message
    t: number[]; // teamCaps: red, blue
    hbs: object | string;
}
interface Kits {
    _kname: string;
    colors: number[];
}

export class GameManager {
    public roomParams: any;
    public adminPasswords: string[] = [];
    public superAdminPasswords: string[] = [];
    public developerPasswords: string[] = [];
    public savedAdminAuths: { data: SavedAdminData[], url: string } = { data: [], url: process.env.SAVED_ADMIN_AUTHS_URL };
    public blockNewTab: boolean = process.env.NODE_ENV === "development" ? false : true;
    public stadiums: { data: Stadium[], url: string, selectedStadiumName: string, currentStadiumMessage: string } = { data: [], url: process.env.STADIUMS_URL, selectedStadiumName: "default", currentStadiumMessage: "" };
    public kits: { data: Kits[], url: string, selectedKitId: number } = { data: [], url: process.env.KITS_URL, selectedKitId: 0 };
    public welcomeMessage: string = "";
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
    public recentPlayers: StoredPlayer[] = [];
    public isCachingChat: boolean = false;
    public chatCache: string[] = [];
    public chatCacheLimit: number = 0;
    public isTrackingAfks: boolean = true;

    public timers: {
        afkCheckInterval: ReturnType<typeof setInterval> | null;
        balanceTimer: ReturnType<typeof setTimeout> | null;
        startTimer: ReturnType<typeof setTimeout> | null;
        unpauseTimer: ReturnType<typeof setTimeout> | null;
        captainPickInterval: ReturnType<typeof setInterval> | null;
        pendingPromise: Promise<void> | null;
        resolvePending: (() => void) | null;
    } = { afkCheckInterval: null, balanceTimer: null, captainPickInterval: null, startTimer: null, unpauseTimer: null, pendingPromise: null, resolvePending: null }

    constructor(roomParams: any) {
        console.log(`room is ${roomParams.public ? "public" : "private"}`);
        this.roomParams = roomParams;
    }

    createRoom(extraParams: any = {}): any {
        Object.assign(this.roomParams, extraParams);
        // token
        let token = null;
        if (process.env.HAXBALL_PLATFORM === "puppeteer") {
            token = (window as any).HB_TOKEN;
        } else if (process.env.HAXBALL_PLATFORM === "browser") {
            token = process.env.DEV_HB_TOKEN;
        } else if (process.env.HAXBALL_PLATFORM === "node") {
            token = hjsToken;
        }
        if (token) {
            this.roomParams.token = token;
        }
        // geo
        if (process.env.HB_ROOM_GEO) {
            this.roomParams.geo = JSON.parse(process.env.HB_ROOM_GEO);
        }
        // passwords:
        if (!process.env.PASSWORDS_ADMIN) {
            console.log("You did not set admin passwords in .env file. You can only be promoted to admin if you use env.SAVED_ADMIN_AUTHS_URL");
        }
        this.adminPasswords = process.env.PASSWORDS_ADMIN ? process.env.PASSWORDS_ADMIN.split(",") : [];
        this.superAdminPasswords = process.env.PASSWORDS_SUPERADMIN ? process.env.PASSWORDS_SUPERADMIN.split(",") : [];
        this.developerPasswords = process.env.PASSWORDS_DEVELOPER ? process.env.PASSWORDS_DEVELOPER.split(",") : [];
        console.log(`calling HBInit with token: ${token} and geo: ${JSON.stringify(this.roomParams.geo)}`);
        const room = HBInit(this.roomParams);
        return room;
    }

    async changeTeamCaps(red: number, blue: number) {
        this.teamCaps.red = red;
        this.teamCaps.blue = blue;
        if (playerManager.red.size > red) {
            // spec surplus red players
            const surplusRedPlayers = util.getRandomFromSetMultiple(playerManager.red, playerManager.red.size - red);
            for (const player of surplusRedPlayers) {
                await playerManager.movePlayerToTeam(player, 0);
            }
        }
        if (playerManager.blue.size > blue) {
            // spec surplus blue players
            const surplusBluePlayers = util.getRandomFromSetMultiple(playerManager.blue, playerManager.blue.size - blue);
            for (const player of surplusBluePlayers) {
                await playerManager.movePlayerToTeam(player, 0);
            }
        }
        await balancing.balanceTeamsWithTimeout(1000);
        return `${red}v${blue}`;
    }
    pauseTheGame(pauseState: boolean) {
        if (!this.isGameGoingOn) {
            if (this.timers.unpauseTimer) clearTimeout(this.timers.unpauseTimer);
            return
        }
        // do not set unpauseTimer here, set only for manual pauses
        room.pauseGame(pauseState);
        this.isGamePaused = pauseState;
    }
    checkAfks() {
        const _now = new Date();
        playerManager.all.forEach(async p => {
            if (p.team === 0) { return; }
            const deltaTime = _now.getTime() - p.lastActivity.getTime();
            if (deltaTime > 20000) {
                if (p.isSuperAdmin) { // if admin, spec
                    util.messageAdmins(`${p.name} assigned to spectate due to AFK`);
                    p.spectatingSince = _now;
                    p.afkGamesCount = 0;
                    //await playerManager.movePlayerToTeam(p, 3);
                    await playerManager.setAfk(p, true);
                    await balancing.reorderSpecs();
                    await balancing.balanceTeamsWithTimeout(500);
                } else {// if not admin, kick
                    room.kickPlayer(p.id, "AFK", false);
                }
            } else if (deltaTime > 10000) {
                util.pm(p, `${p.name}, ${Math.ceil((20000 - deltaTime) / 1000)} saniye içinde geri dönmezseniz atılacaksınız!`, "warning");
            }
        });
    }
    resetAfkChecks() {
        //for (const player of playerManager.all.values()) {
        playerManager.all.forEach((player) => {
            player.lastActivity = new Date();
        });
    }
    setAfkTracking(value: boolean) {
        this.isTrackingAfks = value;
        if (value) {
            room.onPlayerActivity = (vanillaPlayer: VanillaPlayer) => {
                const player = playerManager.all.get(vanillaPlayer.id);
                if (!player) { return }
                player.lastActivity = new Date();
            }
            this.resetAfkChecks();
            this.resumeAfkChecks();
        } else {
            room.onPlayerActivity = null;
            this.resetAfkChecks();
            this.pauseAfkChecks();
        }
    }
    pauseAfkChecks() {
        if (this.timers.afkCheckInterval) clearInterval(this.timers.afkCheckInterval);
    }
    resumeAfkChecks() {
        if (this.timers.afkCheckInterval) clearInterval(this.timers.afkCheckInterval);
        this.timers.afkCheckInterval = setInterval(this.checkAfks, 5000);
    }
}
// roomName: string = "Haxball Room", maxPlayers: number = 12, isPublic: boolean = false
export const gameManager = new GameManager({ roomName: process.env.HB_ROOM_NAME || "Haxball Room", maxPlayers: 14, public: process.env.HB_ROOM_PUBLIC && (process.env.HB_ROOM_PUBLIC === "false") ? false : true, noPlayer: true });
util.fetchData(null, "admins");
util.fetchData(null, "stadiums");
util.fetchData(null, "kits");
const room = gameManager.createRoom();
export { room };

import { Config } from "./config";
import { gameManager, room } from "./GameManager";
import { Player, playerManager, VanillaPlayer } from "./PlayerManager";

export const util = {
    sleep(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    },

    shuffleArray<T>(arr: T[]): T[] {
        return [...arr].sort(() => Math.random() - 0.5);
    },
    getRandomFromArray<T>(arr: readonly T[]): T { return arr[Math.floor(Math.random() * arr.length)]; },
    getRandomFromSet<T>(set: ReadonlySet<T>): T {
        if (set.size === 0) throw new Error("set is empty");
        const idx = Math.floor(Math.random() * set.size);
        let i = 0;
        for (const item of set) {
            if (i++ === idx) return item;
        }
        throw new Error("set is empty");
    },
    getRandomFromSetMultiple<T>(set: ReadonlySet<T>, count: number): T[] {
        if (set.size === 0) throw new Error("set is empty");
        if (count > set.size) throw new Error("count is greater than set size");
        const result: T[] = [];
        const copy = new Set(set);
        for (let i = 0; i < count; i++) {
            const item = util.getRandomFromSet(copy);
            result.push(item);
            copy.delete(item);
        }
        return result;
    },
    nameToMention(name: string) { return "@" + name.replaceAll(" ", "_"); },
    debugLog(message?: unknown) {
        let text: string;

        if (message === null || message === undefined) {
            text = "no message";
        } else if (message instanceof Error) {
            //text = message.stack ?? `${message.name}: ${message.message}`;
            const firstStackLine = message.stack?.split("\n")[1]?.trim(); // skip line 0 (it's just the name+message repeated)
            text = `${message.name}: ${message.message}` + (firstStackLine ? ` (${firstStackLine})` : "");
        } else if (typeof message === "string") {
            text = message;
        } else {
            text = String(message);
        }

        const outputMsg = "📔 " + text;
        console.log(outputMsg);
        playerManager.developers.forEach(p => room.sendAnnouncement(outputMsg, p.id, Config.colors.gold));
    },
    parseTrue(str: string) { return ["1", "on", "yes", "y", "true"].includes(str); },
    parseFalse(str: string) { return ["0", "off", "no", "n", "false", "null"].includes(str); },
    parseBoolean(str: string, defaultTo = false) { if (defaultTo === false) { return util.parseTrue(str) ? true : false } else { return util.parseFalse(str) ? false : true } },
    variableToString(variable: any): string {
        switch (typeof variable) {
            case "boolean":
                return variable ? "✔️ true" : "❌ false";
            case "number":
                return variable === Infinity ? "∞ Infinity" : `🔢 ${variable}`;
            case "string":
                return `"${variable}"`;
            case "undefined":
                return "⚠️ undefined";
            case "object":
                return `📦 ${JSON.stringify(variable)}`;
            default:
                return String(variable);
        }
    },
    messageAdmins(message: string) {
        if (!playerManager.admins.size) { return }
        message = "[🌟] " + message;
        playerManager.admins.forEach(p => room.sendAnnouncement(message, p.id, Config.colors.gold));
    },
    messageSuperAdmins(message: string) {
        if (!playerManager.superAdmins.size) { return }
        message = "[🪐] " + message;
        playerManager.superAdmins.forEach(p => room.sendAnnouncement(message, p.id, Config.colors.gold));
    },
    messageDevelopers(message: string) {
        if (!playerManager.developers.size) { return }
        message = "[🌌] " + message;
        playerManager.developers.forEach(p => room.sendAnnouncement(message, p.id, Config.colors.gold));
    },
    say(message: string) {
        room.sendAnnouncement("" + message, null, Config.colors.green);
    },
    pm(player: Player | VanillaPlayer, message: string, messageType: 'info' | 'error' | 'warning' | 'success' | 'whisper' | 'default' = 'default') {
        let color: number | null = null, msgPrefix: string;
        switch (messageType) {
            case 'info':
                color = Config.colors.pink;//teal;
                msgPrefix = "ℹ️";
                break;
            case 'error':
                color = Config.colors.error;
                msgPrefix = "❌";
                break;
            case 'warning':
                color = Config.colors.orange;
                msgPrefix = "⚠️";
                break;
            case 'success':
                color = Config.colors.green;
                msgPrefix = "✔️";
                break;
            case 'whisper':
                color = Config.colors.pink;
                msgPrefix = "🗪";
                break;
            default:
                msgPrefix = "[PM]";
                break;
        }
        room.sendAnnouncement(msgPrefix + " " + message, player.id, color);
    },
    validatePlayer(vanillaPlayer: VanillaPlayer): boolean {
        for (const [key, otherPlayer] of playerManager.all) {
            if (vanillaPlayer.name === otherPlayer.name) {
                room.kickPlayer(vanillaPlayer.id, `Bu isimde bir oyuncu var`, false);
                return false;
            }
        }
        if (gameManager.blockNewTab) {
            for (const [key, otherPlayer] of playerManager.all) {
                if (vanillaPlayer.conn === otherPlayer.conn || vanillaPlayer.auth === otherPlayer.auth) {
                    room.kickPlayer(vanillaPlayer.id, `Çoklu giriş (${otherPlayer.name})`, false);
                    return false;
                }
            }
        }
        // TODO: blacklist checks
        return true;
    },
    mutePlayer(player: Player, now: Date, mins: number, reason: string | null = null, announce: boolean = true) {
        player.chatMutedUntil = new Date(mins > 0 ? now.getTime() + (mins * 60000) : 0);
        if (announce) {
            util.say(`🔕 ${player.name} ${mins > 0 ? `${mins} dakika susturuldu` : 'artık konuşabilir'}${reason ? ` (${reason})` : ''}`);
        }
    },
    checkSpam(player: Player, message: string) {
        if (player.isSuperAdmin) { return true }
        if (player.isAfk) {
            util.pm(player, `${player.name}, AFK'siniz. Geri döndüyseniz lütfen .back komutunu kullanın`, "warning");
        }
        const now = new Date();
        let dt;
        if (player.chatMutedUntil < new Date(0)) {// initial slowmode
            if (new Date(-player.chatMutedUntil) < now) { player.chatMutedUntil = new Date(0) }//slowmode expired
            else if (message.length > 15) { player.chatMutedUntil = new Date(-player.chatMutedUntil) }
        }
        if (player.chatMutedUntil > now) {
            util.pm(player, `Şu anda yazı yazamazsınız`, "error");
            return false
        } else {
            dt = now.getTime() - player.chatLastTimestamp.getTime();
        }
        if (dt > 5000) {
            player.chatSpamTickets = 0;
        } else if (dt < 1100) {
            if (++player.chatSpamTickets > 2) { // was >1
                player.chatSpamTickets = 0;
                util.mutePlayer(player, now, 1, "spam");
                return false
            }
        }
        player.chatLastTimestamp = now;
        return true;
    },
    setRoomPassword(password: string | null) {
        gameManager.roomPassword = password;
        room.setPassword(password);
        if (password) {
            function formatIstanbulDate(date: Date = new Date()): string {
                return date.toLocaleString("tr-TR", {
                    timeZone: "Europe/Istanbul",
                    day: "2-digit",
                    month: "2-digit",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                });
            }
            util.messageAdmins(`ℹ️ New room password: ${password}`);
            fetch(process.env.DISCORD_ROOMPASSWORD_URL, {
                method: "PATCH",
                body: JSON.stringify({ "content": `**Oda şifresi:** ${password}\n*${formatIstanbulDate()}*` }),
                headers: { "Content-Type": "application/json", },
            }).catch((err) => {
                util.debugLog("Discord room password update failed: " + (err instanceof Error ? err.message : String(err)));
            });
        } else {
            util.messageAdmins(`ℹ️ Room password cleared.`);
        }
    },
    setAutoCapacityPassword() {
        if (gameManager.autoPasswordCapacity > 0) {
            const numPlayers = playerManager.all.size - playerManager.afks.size;
            if (!gameManager.roomPassword && numPlayers >= gameManager.autoPasswordCapacity) {
                const randomPassword = Math.random().toString(36).substring(2);
                util.setRoomPassword(randomPassword);
            } else if (numPlayers < gameManager.autoPasswordCapacity && gameManager.roomPassword) {
                util.setRoomPassword(null);
            }
        }
    },
    fetchData(player: Player | null, keyQuery: string, urlQuery?: string) {
        let targetObj: { data: unknown, url: string }, targetURL: string;
        switch (keyQuery) {
            case "admins":
                targetObj = gameManager.savedAdminAuths;
                break;
            case "stadiums":
                targetObj = gameManager.stadiums;
                break;
            case "kits":
                targetObj = gameManager.kits;
                break;
            default:
                if (player) { util.pm(player, "unknown key: " + keyQuery, "error"); }
                return;
        }
        if (urlQuery) {
            targetURL = urlQuery;
        } else {
            targetURL = targetObj.url;
        }
        util.messageAdmins(`${player ? player.name : "bot"} refetched ${keyQuery}`);
        fetch(targetURL).
            then(function (b) { return b.ok ? b.json() : Promise.reject({ status: b.status, statusText: b.statusText }) })
            .then(function (c) { targetObj.data = c; console.log(`${c.length}x ${keyQuery} downloaded`); })
            .catch((e) => { console.log(`error while fetching ${keyQuery}: ${e}`) });
    },
    async geminiAnalyzeChat(messages: string[]) {
        if (!process.env.GEMINI_API_KEY) { return }
        const API_KEY = process.env.GEMINI_API_KEY;
        const MODEL = "gemini-2.5-flash";
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${API_KEY}`;
        const payload = {
            systemInstruction: { parts: [{ text: "Analyze and commentate on this haxball chat. Summarize the situation from a third person perspective. Write your output in Turkish." }] },
            contents: gameManager.chatCache.map(msg => ({
                role: "user",
                parts: [{ text: msg }]
            }))
        };
        try {
            const response = await fetch(url, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                //util.pm(player, `HTTP error! Status: ${response.status}`);
                util.messageDevelopers(`Gemini HTTP error! Status: ${response.status}`)
                return { ok: false, error: `Gemini HTTP error! Status: ${response.status}` };
            }
            const data = await response.json();
            const answer = data.candidates[0].content.parts[0].text;
            util.say(`Gemini: ${answer}`);
        } catch (e) {
            util.messageDevelopers(`AI hatası: ${e}`);
            return { ok: false, error: `AI hatası: ${e}` };
        }


    }
};
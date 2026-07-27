import { Config } from "./config";
import { gameManager, room, util } from "./main";
import { Player, playerManager, VanillaPlayer } from "./PlayerManager";
export function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

export function shuffleArray<T>(arr: T[]): T[] {
    return [...arr].sort(() => Math.random() - 0.5);
}
export function getRandomFromArray<T>(arr: readonly T[]): T { return arr[Math.floor(Math.random() * arr.length)]; }
export function getRandomFromSet<T>(set: ReadonlySet<T>): T {
    if (set.size === 0) throw new Error("set is empty");
    const idx = Math.floor(Math.random() * set.size);
    let i = 0;
    for (const item of set) {
        if (i++ === idx) return item;
    }
    throw new Error("set is empty");
}
export function nameToMention(name: string) { return "@" + name.replaceAll(" ", "_"); }
export function debugLog(message?: unknown) {
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

    const outputMsg = "[DBG] " + text;
    console.log(outputMsg);
    playerManager.developers.forEach(p => room.sendAnnouncement(outputMsg, p.id, Config.colors.gold));
}

export function messageAdmins(message: string) {
    if (!playerManager.admins.size) { return }
    message = "[Admins] " + message;
    playerManager.admins.forEach(p => room.sendAnnouncement(message, p.id, Config.colors.gold));
}
export function messageSuperAdmins(message: string) {
    if (!playerManager.superAdmins.size) { return }
    message = "[SuperAdmins] " + message;
    playerManager.superAdmins.forEach(p => room.sendAnnouncement(message, p.id, Config.colors.gold));
}
export function messageDevelopers(message: string) {
    if (!playerManager.developers.size) { return }
    message = "[Devs] " + message;
    playerManager.developers.forEach(p => room.sendAnnouncement(message, p.id, Config.colors.gold));
}
export function say(message: string) {
    room.sendAnnouncement(message, null, Config.colors.green);
}
export function pm(player: Player, message: string, messageType: 'info' | 'error' | 'warning' | 'success' | 'default' = 'default') {
    let color: number | null = null, msgPrefix: string;
    switch (messageType) {
        case 'info':
            color = Config.colors.teal;
            msgPrefix = "ℹ️ ";
            break;
        case 'error':
            color = Config.colors.error;
            msgPrefix = "❌ ";
            break;
        case 'warning':
            color = Config.colors.orange;
            msgPrefix = "⚠️ ";
            break;
        case 'success':
            color = Config.colors.green;
            msgPrefix = "✔️ ";
            break;
        default:
            msgPrefix = "[PM]";
            break;
    }
    room.sendAnnouncement(msgPrefix + " " + message, player.id, color);
}
// export function errorPM(player: Player, message: string) {
//     room.sendAnnouncement("❌ " + message, player.id, Config.colors.error);
// }
// export function warningPM(player: Player, message: string) {
//     room.sendAnnouncement("⚠️ " + message, player.id, Config.colors.orange);
// }
// export function infoPM(player: Player, message: string) {
//     room.sendAnnouncement("ℹ️ " + message, player.id, Config.colors.teal);
// }
// export function successPM(player: Player, message: string) {
//     room.sendAnnouncement("✔️ " + message, player.id, Config.colors.green);
// }
export function validatePlayer(vanillaPlayer: VanillaPlayer): boolean {
    for (const [key, obj] of playerManager.all) {
        if (vanillaPlayer.name === obj.name) {
            room.kickPlayer(vanillaPlayer.id, `Bu isimde bir oyuncu var`, false);
            return false;
        }
    }
    if (gameManager.blockNewTab) {
        for (const [key, obj] of playerManager.all) {
            if (vanillaPlayer.conn === obj.conn || vanillaPlayer.auth === obj.auth) {
                room.kickPlayer(vanillaPlayer.id, `Çoklu giriş ${obj.name}`, false);
                return false;
            }
        }
    }
    // TODO: blacklist checks
    return true;
}

export function mutePlayer(player: Player, now: Date, mins: number, reason: string | null = null, announce: boolean = true) {
    player.chatMutedUntil = new Date(mins > 0 ? now.getTime() + (mins * 60000) : 0);
    if (announce) {
        say(`🔕 ${player.name} ${mins > 0 ? `${mins} dakika susturuldu` : 'artık konuşabilir'}${reason ? ` (${reason})` : ''}`);
    }
}
export function checkSpam(player: Player, message: string) {
    if (player.isSuperAdmin) { return true }
    if (player.isAfk) {
        util.pm(player, `⚠️ ${player.name}, AFK'siniz. Geri döndüyseniz lütfen .back komutunu kullanın`, "warning");
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
}
export function setRoomPassword(password: string | null) {
    gameManager.roomPassword = password;
    room.setPassword(password);
    if (password) {
        util.messageAdmins(`ℹ️ New room password: ${password}`);
        fetch(process.env.DISCORD_ROOMPASSWORD_URL, {
            method: "PATCH",
            body: JSON.stringify({ "content": `**Oda şifresi:** ${password}` }),
            headers: { "Content-Type": "application/json", },
        })
    } else {
        util.messageAdmins(`ℹ️ Room password cleared.`);
    }
}
export function setAutoCapacityPassword() {
    if (gameManager.autoPasswordCapacity > 0) {
        const numPlayers = playerManager.all.size - playerManager.afks.size;
        if (!gameManager.roomPassword && numPlayers >= gameManager.autoPasswordCapacity) {
            const randomPassword = Math.random().toString(36).substring(2);
            util.setRoomPassword(randomPassword);
        } else if (numPlayers < gameManager.autoPasswordCapacity && gameManager.roomPassword) {
            util.setRoomPassword(null);
        }
    }
}

export function fetchData(player: Player | null, keyQuery: string, urlQuery?: string) {
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
}
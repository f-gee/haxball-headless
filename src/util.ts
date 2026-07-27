import { Config } from "./config";
import { room, util } from "./main";
import { Player, playerManager } from "./PlayerManager";
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
export function pm(player: Player, message: string) {
    room.sendAnnouncement("[PM] " + message, player.id, Config.colors.teal);
}
export function errorPM(player: Player, message: string) {
    room.sendAnnouncement("❌ " + message, player.id, Config.colors.error);
}

export function warningPM(player: Player, message: string) {
    room.sendAnnouncement("⚠️ " + message, player.id, Config.colors.orange);
}

export function infoPM(player: Player, message: string) {
    room.sendAnnouncement("ℹ️ " + message, player.id, Config.colors.teal);
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
        util.warningPM(player, `⚠️ ${player.name}, AFK'siniz. Geri döndüyseniz lütfen .back komutunu kullanın`);
    }
    const now = new Date();
    let dt;
    if (player.chatMutedUntil < new Date(0)) {// initial slowmode
        if (new Date(-player.chatMutedUntil) < now) { player.chatMutedUntil = new Date(0) }//slowmode expired
        else if (message.length > 15) { player.chatMutedUntil = new Date(-player.chatMutedUntil) }
    }
    if (player.chatMutedUntil > now) {
        util.errorPM(player, `Şu anda yazı yazamazsınız`);
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
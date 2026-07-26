import { Config } from "./config";
import { room } from "./main";
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
    message = "[Admins] " + message;
    playerManager.admins.forEach(p => room.sendAnnouncement(message, p.id, Config.colors.gold));
}
export function messageSuperAdmins(message: string) {
    message = "[SuperAdmins] " + message;
    playerManager.superAdmins.forEach(p => room.sendAnnouncement(message, p.id, Config.colors.gold));
}
export function messageDevelopers(message: string) {
    message = "[Devs] " + message;
    playerManager.developers.forEach(p => room.sendAnnouncement(message, p.id, Config.colors.gold));
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

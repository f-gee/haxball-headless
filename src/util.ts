import { Config } from "./config";
import { room } from "./main";
import { playerManager } from "./PlayerManager";
import { Player } from "./types";
export function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

export function shuffleArray<T>(arr: T[]): T[] {
    return [...arr].sort(() => Math.random() - 0.5);
}

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

export function pm(player: Player, message: string) {
    room.sendAnnouncement("[PM] " + message, player.id, Config.colors.teal);
}

export function errorPM(player: Player, message: string) {
    room.sendAnnouncement("❌ " + message, player.id, Config.colors.error);
}

import type { Player } from './types';
//import * as Player from './types';
import * as util from './util';

export function balanceTeams(players: Player[]): { red: Player[]; blue: Player[] } {
    const shuffled = util.shuffleArray(players);
    const mid = Math.ceil(shuffled.length / 2);
    return { red: shuffled.slice(0, mid), blue: shuffled.slice(mid) };
}
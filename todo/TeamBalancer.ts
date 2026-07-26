// written by AI.. probably buggy af

import { playerManager } from '../src/PlayerManager';
import { room, gameManager } from '../src/main';
import * as util from '../src/util';

export function balanceTeams() {
    const redPlayers = Array.from(playerManager.redTeam);
    const bluePlayers = Array.from(playerManager.blueTeam);
    const allPlayers = Array.from(playerManager.all.values());
    const specs = allPlayers.filter(p => p.team === 0 && !p.isAfk);

    let redCount = redPlayers.length;
    let blueCount = bluePlayers.length;
    const maxPlayers = gameManager.playersPerTeam;

    // 1. Move excess players to spectators if teams are over the limit
    while (redCount > maxPlayers) {
        const p = redPlayers.pop();
        if (p) {
            room.setPlayerTeam(p.id, 0);
            playerManager.handleTeamChange(p.id, 0);
            specs.push(p);
            redCount--;
        }
    }
    while (blueCount > maxPlayers) {
        const p = bluePlayers.pop();
        if (p) {
            room.setPlayerTeam(p.id, 0);
            playerManager.handleTeamChange(p.id, 0);
            specs.push(p);
            blueCount--;
        }
    }

    // 2. If teams are still uneven, move players from the larger team to the smaller team
    if (redCount > blueCount + 1) {
        const diff = Math.floor((redCount - blueCount) / 2);
        for (let i = 0; i < diff; i++) {
            const p = redPlayers.pop();
            if (p) {
                room.setPlayerTeam(p.id, 2);
                playerManager.handleTeamChange(p.id, 2);
                blueCount++;
                redCount--;
            }
        }
    } else if (blueCount > redCount + 1) {
        const diff = Math.floor((blueCount - redCount) / 2);
        for (let i = 0; i < diff; i++) {
            const p = bluePlayers.pop();
            if (p) {
                room.setPlayerTeam(p.id, 1);
                playerManager.handleTeamChange(p.id, 1);
                redCount++;
                blueCount--;
            }
        }
    }

    // 3. Add spectators to fill up the teams up to maxPlayers
    const shuffledSpecs = util.shuffleArray([...specs]);
    while (shuffledSpecs.length > 0 && (redCount < maxPlayers || blueCount < maxPlayers)) {
        const p = shuffledSpecs.pop();
        if (!p) continue;

        if (redCount <= blueCount && redCount < maxPlayers) {
            room.setPlayerTeam(p.id, 1);
            playerManager.handleTeamChange(p.id, 1);
            redCount++;
        } else if (blueCount < redCount && blueCount < maxPlayers) {
            room.setPlayerTeam(p.id, 2);
            playerManager.handleTeamChange(p.id, 2);
            blueCount++;
        }
    }
}

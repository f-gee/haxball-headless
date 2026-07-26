import { Player, playerManager } from './PlayerManager';
import * as util from './util';
import { room, gameManager } from './GameManager';

export async function reorderSpecs() {
    const sortedSpecsArray = [...playerManager.spectators].sort(
        (a, b) => a.spectatingSince.getTime() - b.spectatingSince.getTime()
    );
    playerManager.spectators.clear();
    sortedSpecsArray.forEach(p => playerManager.spectators.add(p));
    await room.reorderPlayers(sortedSpecsArray.map(s => s.id), true);
};

export function balanceTeamsWithTimeout(duration: number): Promise<void> {
    if (gameManager.timers.balanceTimer) {
        clearTimeout(gameManager.timers.balanceTimer);
    }

    if (!gameManager.timers.pendingPromise) {
        gameManager.timers.pendingPromise = new Promise((resolve) => {
            gameManager.timers.resolvePending = resolve;
        });
    }

    const promise = gameManager.timers.pendingPromise;

    gameManager.timers.balanceTimer = setTimeout(async () => {
        gameManager.timers.balanceTimer = null;
        const resolve = gameManager.timers.resolvePending;
        gameManager.timers.pendingPromise = null;
        gameManager.timers.resolvePending = null;

        try {
            if (gameManager.captainMode) {
                await balanceTeams_withCaptainMode();
            } else {
                await balanceTeams();
            }
        } catch (err) {
            console.error('balanceTeamsWithTimeout failed:', err);
        } finally {
            resolve?.();
        }
    }, duration);

    return promise;
}

export async function balanceTeams() {
    const btLog = util.debugLog;
    const orderedSpecsArray = [...playerManager.spectators].filter(a => !a.isAfk).sort((a, b) => +a.spectatingSince - +b.spectatingSince);
    btLog(`orderedSpecsArray = ` + orderedSpecsArray.map(x => x.name).join(', '));
    const totalActivePlayers = playerManager.redTeam.size + playerManager.blueTeam.size + orderedSpecsArray.length;
    // first, remove any overflow
    if (playerManager.redTeam.size > gameManager.teamCaps.red) {
        let numToRemove = playerManager.redTeam.size - gameManager.teamCaps.red;
        //btLog(`red had too many players. speccing ${numToRemove} player(s) from red`);
        const playersToRemove = [...playerManager.redTeam].slice(0, numToRemove);
        playersToRemove.forEach(player => playerManager.movePlayerToTeam(player, 0));
    }
    if (playerManager.blueTeam.size > gameManager.teamCaps.blue) {
        let numToRemove = playerManager.blueTeam.size - gameManager.teamCaps.blue;
        //btLog(`blue had too many players. speccing ${numToRemove} player(s) from blue`);
        const playersToRemove = [...playerManager.blueTeam].slice(0, numToRemove);
        playersToRemove.forEach(player => playerManager.movePlayerToTeam(player, 0));
    }

    if (orderedSpecsArray.length === 0) {
        return;
    }
    // now add specs
    let numSpecsNeeded = Math.min(gameManager.teamCaps.red + gameManager.teamCaps.blue - (playerManager.redTeam.size + playerManager.blueTeam.size), orderedSpecsArray.length);
    btLog(`numSpecsNeeded` + numSpecsNeeded + " totalActivePlayers" + totalActivePlayers + " redTeam.size" + playerManager.redTeam.size + " blueTeam.size" + playerManager.blueTeam.size);
    if (numSpecsNeeded > 0) {
        let targetTeam;
        const specs = orderedSpecsArray.slice(0, numSpecsNeeded);
        for (const spec of specs) {
            if (numSpecsNeeded === 1 && totalActivePlayers > 1 && gameManager.forceEqualTeams && (playerManager.redTeam.size + playerManager.blueTeam.size) % 2 === 0) {
                //btLog(`skipping last spec (${_spec.name}) to keep teams even`);
                break;
            }
            targetTeam = playerManager.redTeam.size > playerManager.blueTeam.size ? 2 : (playerManager.redTeam.size < playerManager.blueTeam.size ? 1 : (spec.restoreTeam > 0 && totalActivePlayers > 1 ? spec.restoreTeam : gameManager.nextKickOffTeamId));
            await playerManager.movePlayerToTeam(spec, targetTeam);
            numSpecsNeeded--;
        }
    }
    // all specs added. now handle big imbalances
    while (Math.abs(playerManager.redTeam.size - playerManager.blueTeam.size) > 1) {
        const fromTeam = playerManager.redTeam.size > playerManager.blueTeam.size ? 1 : 2;
        const toTeam = fromTeam === 1 ? 2 : 1;
        const playerToMove = util.getRandomFromSet(fromTeam === 1 ? playerManager.redTeam : playerManager.blueTeam);
        //btLog(`big imbalance. randomly picked ${playerToMove.name} from team ${fromTeam} to team ${toTeam}`);
        await playerManager.movePlayerToTeam(playerToMove, toTeam);
        util.debugLog(`${util.nameToMention(playerToMove.name)}, takımları dengelemek için ${toTeam === 1 ? "kırmızı" : "mavi"} takıma geçirildi`);
        util.pm(playerToMove, `${util.nameToMention(playerToMove.name)}, takımları dengelemek için ${toTeam === 1 ? "kırmızı" : "mavi"} takıma geçirildiniz!`);
    }
    // final check for forceEqualTeams
    if (gameManager.forceEqualTeams && totalActivePlayers > 1 && playerManager.redTeam.size !== playerManager.blueTeam.size) {
        const fromTeam = playerManager.redTeam.size > playerManager.blueTeam.size ? 1 : 2;
        const playerToMove = util.getRandomFromSet(fromTeam === 1 ? playerManager.redTeam : playerManager.blueTeam);
        //btLog(`forcing equal teams. it was ${teams[1].length}v${teams[2].length}. Moving ${playerToMove.name} to spec`);
        await playerManager.movePlayerToTeam(playerToMove, 0);
        playerToMove.restoreTeam = fromTeam;
        playerToMove.spectatingSince = new Date(0);; // to make sure they are on top
        await reorderSpecs();
        util.pm(playerToMove, "Takımlar dengesiz olduğu için geçici olarak spece alındınız");
    }
    if (gameManager.isGamePaused /*&& !(data.miscStuff.manualUnpauseTimer)*/) {
        room.pauseGame(false);
    }
    if (!gameManager.isGameGoingOn && (!gameManager.timers.startTimer || gameManager.gameEndAutoStart)) {
        //room.startGame();
        //util.debugLog("game will start in 3 seconds");
        gameManager.timers.startTimer = setTimeout(room.startGame, 3000);
    }
}
export async function balanceTeams_withCaptainMode() {
    util.debugLog("TODO captain mode");
}
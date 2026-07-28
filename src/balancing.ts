import { Player, VanillaPlayer, playerManager } from './PlayerManager';
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
    //const orderedSpecsArray = [...playerManager.spectators].filter(a => !a.isAfk).sort((a, b) => +a.spectatingSince - +b.spectatingSince);
    const orderedSpecsArray = [...playerManager.activeSpectators].sort((a, b) => +a.spectatingSince - +b.spectatingSince);
    btLog(`orderedSpecsArray = ` + orderedSpecsArray.map(x => x.name).join(', '));
    //const totalActivePlayers = playerManager.redTeam.size + playerManager.blueTeam.size + orderedSpecsArray.length;
    const totalActivePlayers = playerManager.all.size - playerManager.afks.size;
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
    //btLog(`numSpecsNeeded` + numSpecsNeeded + " totalActivePlayers" + totalActivePlayers + " redTeam.size" + playerManager.redTeam.size + " blueTeam.size" + playerManager.blueTeam.size);
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
    if (!gameManager.autoBalance) { return }
    const totalActivePlayers = playerManager.all.size - playerManager.afks.size;
    if (totalActivePlayers < (gameManager.teamCaps.red + gameManager.teamCaps.blue)) { // no point in picking
        //bcLog(`CAP: ${totalActivePlayers} active players, auto-balancing..`);
        await balanceTeams();
        if (gameManager.gameEndAutoStart || !gameManager.timers.startTimer) { gameManager.timers.startTimer = setTimeout(room.startGame, 1000); }
        if (gameManager.isGamePaused /*&& (!data.miscStuff.manualUnpauseTimer)*/) { room.pauseGame(false); }
        gameManager.lastTeamThatPicked = 2;
        clearCaptainPrompt();
        return;
    }
    // we have at least 4 active players. 
    // make sure both teams have captains:
    if ((!playerManager.redTeam.size) && (!playerManager.blueTeam.size)) { // special case, mix first two specs
        let firstTwoSpecs = [...playerManager.activeSpectators].slice(0, 2);
        //bcLog(`Both teams were missing captains, first two specs (${firstTwoSpecs.map(x => x.name).join(" and ")}) will be shuffled`);
        util.shuffleArray(firstTwoSpecs);
        await playerManager.movePlayerToTeam(firstTwoSpecs[0], 1);
        await playerManager.movePlayerToTeam(firstTwoSpecs[1], 2);
    } else {
        let firstSpec;
        if (!playerManager.redTeam.size) {
            firstSpec = playerManager.activeSpectators.values().next().value;
            if (firstSpec) {
                await playerManager.movePlayerToTeam(firstSpec, 1);
            }
        }
        if (!playerManager.blueTeam.size) {
            firstSpec = playerManager.activeSpectators.values().next().value;
            if (firstSpec) {
                await playerManager.movePlayerToTeam(firstSpec, 2);
            }
        }
    }
    // we have captains.
    // check for auto actions:
    // overflow:
    {
        if (playerManager.redTeam.size > gameManager.teamCaps.red) {
            const redSurplus = playerManager.redTeam.size - gameManager.teamCaps.red;
            for (let i = 0; i < redSurplus; i++) {
                const playerToMove = playerManager.redTeam.values().next().value;
                if (playerToMove) {
                    await playerManager.movePlayerToTeam(playerToMove, 0);
                }
            }
        }
        if (playerManager.blueTeam.size > gameManager.teamCaps.blue) {
            //bcLog(`Blue has too many players:`);
            const blueSurplus = playerManager.blueTeam.size - gameManager.teamCaps.blue;
            for (let i = 0; i < blueSurplus; i++) {
                const playerToMove = playerManager.blueTeam.values().next().value;
                if (playerToMove) {
                    await playerManager.movePlayerToTeam(playerToMove, 0);
                }
            }
        }
    }
    let redSurplus = playerManager.redTeam.size - playerManager.blueTeam.size;
    let absSurplus = Math.abs(redSurplus);
    let totalNeed = gameManager.teamCaps.red + gameManager.teamCaps.blue - (playerManager.redTeam.size + playerManager.blueTeam.size);
    if (absSurplus === 0 && playerManager.activeSpectators.size === 0) {
        //bcLog(`Teams are equal and no specs left. Starting game..`);
        if (gameManager.gameEndAutoStart || !gameManager.timers.startTimer) { gameManager.timers.startTimer = setTimeout(room.startGame, 1000); }
        if (gameManager.isGamePaused /*&& (!data.miscStuff.manualUnpauseTimer)*/) { room.pauseGame(false); }
        gameManager.lastTeamThatPicked = 2;
        clearCaptainPrompt();
        return;
    }
    // check if first spec player has .restoreTeam:
    const firstSpec = playerManager.activeSpectators.values().next().value;
    if (firstSpec && playerManager.activeSpectators.size === 2 && firstSpec.restoreTeam && absSurplus === 0 && totalNeed === 2) {
        //bcLog(`Restoring ${firstSpec.name} to team ${firstSpec.misc.restoreTeam}`);
        await playerManager.movePlayerToTeam(firstSpec, firstSpec.restoreTeam);
        firstSpec.restoreTeam = 0;
        const secondSpec = playerManager.activeSpectators.values().next().value;
        if (secondSpec) {
            await playerManager.movePlayerToTeam(secondSpec, 3 - firstSpec.team);
            secondSpec.restoreTeam = 0;
        }
        if (gameManager.gameEndAutoStart || !gameManager.timers.startTimer) { gameManager.timers.startTimer = setTimeout(room.startGame, 1000); }
        if (gameManager.isGamePaused /*&& (!data.miscStuff.manualUnpauseTimer)*/) { room.pauseGame(false); }
        gameManager.lastTeamThatPicked = 2;
        clearCaptainPrompt();
        return;
    }

    // check for "single spec, single slot = no choice" case
    const smallTeamId = redSurplus > 0 ? 2 : 1; // beware, redSurplus can be zero
    if (playerManager.activeSpectators.size === 1 && absSurplus === 1) {
        //bcLog(`Team ${smallTeamId} has no choice, giving them ${firstSpec.name}`);
        if (firstSpec) {
            await playerManager.movePlayerToTeam(firstSpec, smallTeamId);
            firstSpec.restoreTeam = 0;
        }
        if (gameManager.gameEndAutoStart || !gameManager.timers.startTimer) { gameManager.timers.startTimer = setTimeout(room.startGame, 1000); }
        if (gameManager.isGamePaused /*&& (!data.miscStuff.manualUnpauseTimer)*/) { room.pauseGame(false); }
        gameManager.lastTeamThatPicked = 2;
        clearCaptainPrompt();
        return;
    }
    const bigTeamId = 3 - smallTeamId;
    const bigTeamName = bigTeamId === 1 ? "red" : "blue";
    const smallTeamName = smallTeamId === 1 ? "red" : "blue";
    const bigTeam = bigTeamId === 1 ? playerManager.redTeam : playerManager.blueTeam;
    const smallTeam = smallTeamId === 1 ? playerManager.redTeam : playerManager.blueTeam;
    // if num specs == num need for one team, and the other team is full:
    if ((bigTeam.size === gameManager.teamCaps[bigTeamName] && playerManager.activeSpectators.size === totalNeed) // 4v2
        || (bigTeam.size === smallTeam.size + playerManager.activeSpectators.size)) // 3v1
    {
        //bcLog(`Team ${smallTeamId} has no choice, giving them ${specs.length} specs: ${specs.map(p => p.name).join(", ")}`);
        playerManager.activeSpectators.forEach(async (player) => {
            await playerManager.movePlayerToTeam(player, smallTeamId);
        });
        if (gameManager.gameEndAutoStart || !gameManager.timers.startTimer) { gameManager.timers.startTimer = setTimeout(room.startGame, 1000); }
        if (gameManager.isGamePaused /*&& (!data.miscStuff.manualUnpauseTimer)*/) { room.pauseGame(false); }
        gameManager.lastTeamThatPicked = 2;
        clearCaptainPrompt();
        return;
    }
    // there can be a surplus:
    if (absSurplus > 0 && playerManager.activeSpectators.size === 0) {
        //bcLog(`Team ${bigTeamId} was too big. Will spec ${absSurplus} random non-captain player(s)`);
        for (let i = 0; i < absSurplus; i++) {
            const randomNonCaptain: Player = util.getRandomFromSet(bigTeam);
            if (randomNonCaptain) {
                await playerManager.movePlayerToTeam(randomNonCaptain, 0);
                randomNonCaptain.restoreTeam = bigTeamId;
                randomNonCaptain.spectatingSince = new Date(0); // so they are on top
            }
        }
    }
    // check if teams are perfect:
    if (playerManager.redTeam.size === gameManager.teamCaps.red && playerManager.blueTeam.size === gameManager.teamCaps.blue) {
        if (gameManager.gameEndAutoStart || !gameManager.timers.startTimer) { gameManager.timers.startTimer = setTimeout(room.startGame, 1000); }
        if (gameManager.isGamePaused /*&& (!data.miscStuff.manualUnpauseTimer)*/) { room.pauseGame(false); }
        gameManager.lastTeamThatPicked = 2;
        clearCaptainPrompt();
        return;
    }
    // auto actions are done.. now prompt captains:
    if (playerManager.activeSpectators.size > 1) {
        let nextTeamId;
        if (absSurplus === 0) {
            nextTeamId = 3 - gameManager.lastTeamThatPicked;
        } else {
            nextTeamId = redSurplus > 0 ? 2 : 1;
        }
        promptCaptain(nextTeamId);
    } else {
        //bcLog("no specs left, starting the game");
        //if (data.miscStuff.gameEndAutoStart || !data.miscStuff.startTimer) { data.miscStuff.startTimer = setTimeout(room.startGame, 1000); }
        gameManager.timers.startTimer = setTimeout(room.startGame, 1000);
        if (gameManager.isGamePaused /*&& (!data.miscStuff.manualUnpauseTimer)*/) { room.pauseGame(false); }
        gameManager.lastTeamThatPicked = 2;
        clearCaptainPrompt();
        return;
    }

}

export function clearCaptainPrompt() {
    gameManager.isCaptainPickingActive = false;
    if (gameManager.timers.captainPickInterval) clearInterval(gameManager.timers.captainPickInterval);
}
export function promptCaptain(teamId: number) {
    const captain = teamId === 1 ? playerManager.redTeam.values().next().value : playerManager.blueTeam.values().next().value;
    if (!captain) { return }
    room.pauseGame(true);
    util.pm(captain, `${captain.name}, oyuncu seçme sırası sizde! İsim ya da sayı yazabilirsiniz`);
    room.sendAnnouncement("" + room.getPlayerList()
        .filter((x: VanillaPlayer) => {
            const player: Player | undefined = playerManager.all.get(x.id);
            if (player && player.team === 0 && !player.isAfk) {
                return true
            }
            return false
        })
        .map((p: Player, i: number) => `[${i + 1}] ${p.name}`)
        .join("   "), captain.id, 0xba8bff
    );
    const promptObj = gameManager.captainPromptObj;
    promptObj.teamId = captain.team;
    promptObj.captainId = captain.id;
    promptObj.secondsRemaining = 15;
    if (gameManager.timers.captainPickInterval) { clearInterval(gameManager.timers.captainPickInterval); }
    gameManager.isCaptainPickingActive = true;
    gameManager.timers.captainPickInterval = setInterval(captainIntervalFunction, 1000);
}

export async function captainIntervalFunction() {
    const promptObj = gameManager.captainPromptObj;
    let secondsRem = --(promptObj.secondsRemaining);
    if (secondsRem % 2 === 0) {
        const targetCaptainId = promptObj.captainId;
        const captain: Player | undefined = playerManager.all.get(targetCaptainId);
        if (captain) {
            if (secondsRem > 0) {
                room.sendAnnouncement("" + room.getPlayerList()
                    .filter((x: VanillaPlayer) => {
                        const player: Player | undefined = playerManager.all.get(x.id);
                        if (player && player.team === 0 && !player.isAfk) {
                            return true
                        }
                        return false
                    })
                    .map((p: Player, i: number) => `[${i + 1}] ${p.name}`)
                    .join("   "), captain.id, 0xba8bff
                );
                //util.debugLog(`${_targetCaptain.name}, oyuncu seçmek için ${secondsRem} saniyeniz kaldı`);
                util.pm(captain, `${captain.name}, oyuncu seçmek için ${secondsRem} saniyeniz kaldı`, "warning");
            } else {
                await playerManager.movePlayerToTeam(captain, 0);
                captain.spectatingSince = new Date(0);
                util.say(`${captain.name} verilen süre içinde seçim yapmadığı için spec'e alındı.`);
                clearCaptainPrompt();
                await reorderSpecs();
                await balanceTeamsWithTimeout(500);
            }
        } else {// should never happen..
            util.debugLog(`no captain..`);
            clearCaptainPrompt();
            await balanceTeamsWithTimeout(500);
            return;
        }
    }
}

export async function captainHandleChoice(player: Player, message: string) {
    let targetPlayer: Player | null;
    const specs = [...playerManager.spectators]; // hope spectators is ordered correctly, so not using room.getPlayerList()
    let isSelectionRandom = false;
    switch (message) {
        case "top":
            targetPlayer = specs[0];
            break;
        case "bottom":
            targetPlayer = specs[specs.length - 1];
            break;
        case "random":
        case "rand":
            isSelectionRandom = true;
            targetPlayer = util.getRandomFromArray(specs)
            break;
        default:
            targetPlayer = playerManager.getByQuery(message);
            break;
    }
    if (!targetPlayer) {
        const tryNumber = parseInt(message);
        if (tryNumber > 0 && tryNumber <= specs.length) {
            targetPlayer = specs[tryNumber - 1];
        } else {
            return util.pm(player, `Geçersiz sayı. En alttaki oyuncular AFK olabilir.`, "error");
        }
    } else { // if they name-picked an AFK:
        targetPlayer = playerManager.getByQuery(message);
        if (targetPlayer) {
            if (targetPlayer.team === 3) {
                return util.pm(player, `${targetPlayer.name} AFK`, "error");
            } else {
                return util.pm(player, `${targetPlayer.name} ${targetPlayer.team === 2 ? "mavi" : "kırmızı"} takımda`, "error");
            }
        }
    }

    if (targetPlayer) {
        if (targetPlayer.team !== 0) { return util.pm(player, "Seçtiğiniz oyuncu zaten takımda", "error"); }
        await playerManager.movePlayerToTeam(targetPlayer, player.team)
        targetPlayer.restoreTeam = 0;
        gameManager.lastTeamThatPicked = player.team;
        clearCaptainPrompt();

        if (isSelectionRandom) {
            util.say(`${player.name} rastgele seçti: ${targetPlayer.name}`);
        } else {
            util.say(`${player.name} seçti: ${targetPlayer.name}`);
        }
        await balanceTeamsWithTimeout(500);
    } else {
        return util.pm(player, "Oyuncu bulunamadı", "error");
    }
}
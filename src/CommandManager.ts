import { gameManager, room } from "./GameManager";
import { util } from "./util";
import { playerManager, Player, VanillaPlayer } from "./PlayerManager";
import { balancing } from "./balancing";
import { Config } from "./config";

export interface Command {
	name: string;
	category: "chat" | "security" | "teams" | "utility" | "game";
	helpStrings: string[];
	minArguments: number;
	cooldownSeconds: number;
	needsAdmin: boolean;
	needsSuperAdmin: boolean;
	execute: (player: Player, args: string[]) => CommandResult | Promise<CommandResult>; // sync | async
}

interface CommandParseResult {
	caller: Player;
	command: Command | null;
	commandName: string;
	args: string[];
}
// export type CommandResult =
// 	| { ok: true; success?: any, info?: string, warning?: string, announce?: string }
// 	| { ok: false; error?: string; needsHelp?: boolean, success?: any, info?: string, warning?: string, announce?: string };
export type CommandResult = { ok: boolean; success?: any, error?: any, info?: string, warning?: string, announce?: string }

export class CommandManager {
	//public commands: Command[];
	public commands: Record<string, Command>;
	public commandAliases: Record<string, string>;
	constructor() {
		this.commands = {};
		this.commandAliases = {
			"v": "version",
			"h": "help",
			"ta": "toggleadmin",
			"t": "teamchat",
			"p": "pause",
			"res": "restart",
			"r": "red",
			"b": "blue",
			"bal": "balance",
			"dc": "discord",
			"load": "map"
		};
	}
	// registerAlias(alias: string, name: string) {
	// 	this.commandAliases[alias] = name;
	// }
	// unregisterAlias(alias: string) {
	// 	delete this.commandAliases[alias];
	// }
	registerCommand(cmd: Command) {
		this.commands[cmd.name] = cmd;
	}
	unregisterCommand(name: string) {
		delete this.commands[name];
	}
	parseCommandInputs(player: Player, message: string) {
		const [cmd, ...args] = message.split(" ");
		const parseResult: CommandParseResult = {
			caller: player,
			command: null,
			commandName: cmd,
			args: []
		}
		let command: Command = this.commands[cmd];
		if (!command) {
			command = this.commands[this.commandAliases[cmd]];
		}
		if (command) {
			parseResult.command = command;
			parseResult.args = args;
		}
		return parseResult;
	}
	async executeCommand(commandData: CommandParseResult): Promise<CommandResult> {
		const { caller, command, args } = commandData;
		if (!command) return { ok: false, error: "Command not found" };
		if (command.needsSuperAdmin && !caller.isSuperAdmin) {
			return { ok: false, error: "This command requires super admin" };
		}
		if (command.needsAdmin && !caller.isAdmin) {
			return { ok: false, error: "This command requires admin" };
		}
		//util.debugLog(`${caller.name}: .${command.name} ${args.join(" ")}`);
		try {
			return await command.execute(caller, args);
		} catch (commandException) {
			util.debugLog(`executeCommand: command failed for player ${caller.name} #${caller.id}`);
			util.debugLog(commandException);
			return { ok: false, error: "Command exception" };
		}
	}
	async parseAndExecuteCommand(player: Player, message: string): Promise<void> {
		util.debugLog(`${player.name}: ${message}`);
		//util.messageDevelopers(`${player.name}: ${message}`);
		const parseResult = this.parseCommandInputs(player, message.substring(1));
		if (!parseResult.command) {
			util.pm(player, `.${parseResult.commandName}: command not found`, "error");
			return;
		}
		if (parseResult.args.length < parseResult.command.minArguments) {
			util.pm(player, `Too few arguments. Use .help ${parseResult.command.name}`, "error");
			return;
		}
		const now = Date.now();
		if (player.commandCooldowns.has(parseResult.command.name) && player.commandCooldowns.get(parseResult.command.name)! > now) {
			util.pm(player, `.${parseResult.command.name}: command is on cooldown`, "error");
			return;
		}
		if (!player.isSuperAdmin) {
			player.commandCooldowns.set(parseResult.command.name, now + parseResult.command.cooldownSeconds * 1000);
		}
		const result = await this.executeCommand(parseResult);
		//console.log("commandResult = " + util.variableToString(result));
		if (!result.ok) {
			if (result.error) {
				util.pm(player, result.error, "error");
			}
			// if (result.needsHelp) {
			// 	const commandName = parseResult.command?.name || "";
			// 	util.pm(player, `For help type .help ${commandName}`, "error");
			// }
		}
		if (result.warning) {
			util.pm(player, result.warning, "warning");
		}
		if (result.info) {
			util.pm(player, result.info, "info");
		}
		if (result.success) {
			util.pm(player, result.success, "success");
		}
		if (result.announce) {
			util.say(result.announce);
		}
	}

} // class CommandManager
export const commandManager = new CommandManager();
commandManager.registerCommand({
	name: "help", category: "utility", helpStrings: [".help: show all commands", ".help [command]: show info about a specific command"], minArguments: 0, cooldownSeconds: 5, needsAdmin: false, needsSuperAdmin: false, execute: (player, args) => {
		if (args.length) { // .help [commandName]
			const commandName = args[0];
			let command = commandManager.commands[commandName];
			if (!command) {
				command = commandManager.commands[commandManager.commandAliases[commandName]];
			}
			if (!command) {
				return { ok: false, error: "Command not found" };
			}
			util.pm(player, `Command: .${command.name}`, "info");
			for (const helpString of command.helpStrings) {
				util.pm(player, helpString, "info");
			}
			return { ok: true };
		} else { // general help
			const categories: Command["category"][] = ["game", "teams", "chat", "security", "utility"];

			for (const category of categories) {
				const names = Object.values(commandManager.commands)
					.filter(c => c.category === category)
					.map(c => "." + c.name)
					.join(" ");

				if (names) {
					util.pm(player, `[${category}]: ${names}`, "info");
				}
			}

			return { ok: true };
		}
	}
});
commandManager.registerCommand({
	name: "version", category: "utility", helpStrings: ["Display bot version"], minArguments: 0, cooldownSeconds: 5, needsAdmin: false, needsSuperAdmin: false,
	execute: (player, args) => {
		return { ok: true, info: `Version: ${process.env.BOT_VERSION}` };
	}
});
commandManager.registerCommand({
	name: "bb", category: "utility", helpStrings: [".bb: leave the room"], minArguments: 0, cooldownSeconds: 1, needsAdmin: false, needsSuperAdmin: false,
	execute: (player, args) => {
		room.kickPlayer(player.id, `See you soon! 👋`, false);
		return { ok: true };
	}
});
if (process.env.DISCORD_INVITE_URL) {
	commandManager.registerCommand({
		name: "discord", category: "utility", helpStrings: ["shows discord invite link"], minArguments: 0, cooldownSeconds: 5, needsAdmin: false, needsSuperAdmin: false,
		execute: (player, args) => {
			util.say(`🎮 Discord adresimiz: ${process.env.DISCORD_INVITE_URL}`);
			return { ok: true };
		}
	});
}
if (process.env.GEMINI_API_KEY) {
	commandManager.registerCommand({
		name: "gemini", category: "chat", helpStrings: [".gemini [prompt]"], minArguments: 1, cooldownSeconds: 3, needsAdmin: true, needsSuperAdmin: true,
		execute: async (player, args) => {
			let q = args.join(" ");
			const API_KEY = process.env.GEMINI_API_KEY;
			const MODEL = "gemini-2.5-flash";
			const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${API_KEY}`;
			const payload = {
				systemInstruction: { parts: [{ text: "Türkçe cevap ver, cevabını haxball text input'a sığacak kadar (100 karakter) civarı kısa tutmaya çalış. Girdi agresifse aynı tonda, gerekirse küfürlü cevap ver." }] },
				contents: [{ parts: [{ text: q }] }],
				//generationConfig: { maxOutputTokens: 1000 }
			};
			try {
				util.say(`${player.name} -> Gemini: ${q}`);
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
				//util.say(`Gemini -> ${player.name}: ${answer}`);
				return { ok: true, announce: `Gemini -> ${player.name}: ${answer}` }
			} catch (e) {
				util.messageDevelopers(`AI hatası: ${e}`);
				return { ok: false, error: `AI hatası: ${e}` };
			}
		}
	});
	commandManager.registerCommand({
		name: "gemini_listen", category: "chat", helpStrings: [".gemini_listen [N]: replies to last N chat messages. N=0 to stop listening"], minArguments: 1, cooldownSeconds: 3, needsAdmin: true, needsSuperAdmin: true,
		execute: async (player, args) => {
			const numMessages = parseInt(args[0]);
			if (isNaN(numMessages) || numMessages < 0 || numMessages > 30) { return { ok: false, error: "Please provide a number between 0 and 30" } }
			if (numMessages === 0) {
				gameManager.isCachingChat = false;
				return { ok: true, announce: `Gemini stopped listening to chat (${player.name})` };
			}
			else {
				gameManager.isCachingChat = true;
				gameManager.chatCache = [];
				gameManager.chatCacheLimit = numMessages;
				return { ok: true, announce: `Gemini will respond to every ${numMessages} messages (${player.name})` };
			}
		}
	});
}
commandManager.registerCommand({
	name: "pm", category: "chat", helpStrings: [".pm [player] [message]: sends a private message to the player"], minArguments: 2, cooldownSeconds: 3, needsAdmin: true, needsSuperAdmin: true,
	execute: async (player, args) => {
		const targetPlayerName = args[0];
		const targetPlayer = await playerManager.getByQuery(targetPlayerName);
		if (!targetPlayer) { return { ok: false, error: `Player ${targetPlayerName} not found` } }
		const message = args.slice(1).join(" ");
		if (!message || !message.length) { return { ok: false, error: "Message cannot be empty" } }
		if (player.id == targetPlayer.id) { return { ok: false, error: "You cannot send a message to yourself" } }
		util.pm(targetPlayer, `[PM from ${player.name}]: ${message}`, "whisper");
		return { ok: true, success: `🗪 [PM to ${targetPlayer.name}]: ${message}` };
	}
});
commandManager.registerCommand({
	name: "admin", category: "security", helpStrings: [".admin [password]: Get admin privileges"], minArguments: 1, cooldownSeconds: 5, needsAdmin: false, needsSuperAdmin: false,
	execute: (player, args) => {
		const passwordInput = args[0];
		if (gameManager.adminPasswords.includes(passwordInput)) {
			playerManager.setAdmin(player, true);
			return { ok: true, success: "You are now admin" };
		}
		if (gameManager.superAdminPasswords.includes(passwordInput)) {
			playerManager.setSuperAdmin(player, true);
			return { ok: true, success: "You are now super admin" };
		}
		if (gameManager.developerPasswords.includes(passwordInput)) {
			playerManager.setDeveloper(player, true);
			return { ok: true, success: "You are developer" };
		}
		return { ok: false, error: "Invalid password" };
	}
});
commandManager.registerCommand({
	name: "promote", category: "security", helpStrings: [".promote [player] admin / superadmin / dev: promote a player to admin"], minArguments: 2, cooldownSeconds: 3, needsAdmin: true, needsSuperAdmin: false,
	execute: (player, args) => {
		const [playerQuery, rank] = args;
		const targetPlayer = playerManager.getByQuery(playerQuery);
		if (!targetPlayer) {
			return { ok: false, error: "Player not found" };
		}
		if (rank === "admin" && player.isAdmin) {
			if (targetPlayer.isAdmin) {
				return { ok: false, error: `${targetPlayer.name} is already admin` };
			}
			playerManager.setAdmin(targetPlayer, true);
			return { ok: true, info: `You promoted ${targetPlayer.id === player.id ? "yourself" : targetPlayer.name} to admin` };
		}
		if (player.isSuperAdmin && rank === "superadmin") {
			if (targetPlayer.isSuperAdmin) {
				return { ok: false, error: `${targetPlayer.name} is already super admin` };
			}
			playerManager.setSuperAdmin(targetPlayer, true);
			return { ok: true, info: `You promoted ${targetPlayer.id === player.id ? "yourself" : targetPlayer.name} to super admin` };
		}
		if (player.isSuperAdmin && rank === "dev") {
			if (targetPlayer.isDeveloper) {
				return { ok: false, error: `${targetPlayer.name} is already developer` };
			}
			playerManager.setDeveloper(targetPlayer, true);
			return { ok: true, info: `You promoted ${targetPlayer.id === player.id ? "yourself" : targetPlayer.name} to developer` };
		}
		return { ok: false, error: "Invalid rank" };
	}
});
commandManager.registerCommand({
	name: "demote", category: "security", helpStrings: [".demote [player]: demote a player"], minArguments: 1, cooldownSeconds: 3, needsAdmin: true, needsSuperAdmin: false,
	execute: (player, args) => {
		const [playerQuery] = args;
		const targetPlayer = playerManager.getByQuery(playerQuery);
		if (!targetPlayer) {
			return { ok: false, error: "Player not found" };
		}
		if (!targetPlayer.isAdmin) {
			return { ok: false, error: `${targetPlayer.name} is not admin` };
		}
		const isAllowed = (player.isDeveloper && !targetPlayer.isDeveloper) || (player.isSuperAdmin && !targetPlayer.isSuperAdmin) || (targetPlayer.id === player.id);
		if (!isAllowed) {
			return { ok: false, error: `You are not allowed to demote ${targetPlayer.name}` };
		}
		const demoteText = targetPlayer.isSuperAdmin ? "from super admin to admin" : "from admin";
		if (player.id === targetPlayer.id) {
			util.pm(player, `You demoted yourself ${demoteText}`, "warning");
		}
		if (targetPlayer.isSuperAdmin) {
			playerManager.setSuperAdmin(targetPlayer, false);
			util.messageSuperAdmins(`${player.name} demoted ${targetPlayer.name} ${demoteText}`);
			return { ok: true };
		} else if (targetPlayer.isAdmin) {
			playerManager.setAdmin(targetPlayer, false);
			util.messageAdmins(`${player.name} demoted ${targetPlayer.name} ${demoteText}`);
			return { ok: true };
		} else {
			return { ok: false, error: "this should never happen" };
		}
	}
});
commandManager.registerCommand({
	name: "toggleadmin", category: "security", helpStrings: [".toggleadmin: toggles your admin visibility", ".toggleadmin [player]: toggles admin visibility of another player"], minArguments: 0, cooldownSeconds: 3, needsAdmin: true, needsSuperAdmin: true,
	execute: (player, args) => {
		let targetPlayer = player;
		if (args.length) {
			const findTargetPlayer = playerManager.getByQuery(args[0]);
			if (findTargetPlayer) {
				targetPlayer = findTargetPlayer;
			} else {
				return { ok: false, error: "Player not found" };
			}
		}
		const vanillaPlayer: VanillaPlayer = room.getPlayer(targetPlayer.id);
		if (!vanillaPlayer) return { ok: false, error: "Player not found" };
		room.setPlayerAdmin(vanillaPlayer.id, !vanillaPlayer.admin);
		util.messageAdmins(`${targetPlayer.name}'s admin visibility toggled`);
		return { ok: true };
	}
});
// TODO: check for superAdmin etc for kick and ban
commandManager.registerCommand({
	name: "kick", category: "security", helpStrings: [".kick [player] [reason]: kicks a player"], minArguments: 1, cooldownSeconds: 3, needsAdmin: true, needsSuperAdmin: false,
	execute: (player, args) => {
		const target = playerManager.getByQuery(args[0]);
		if (!target) return { ok: false, error: "Player not found" };
		if (target.id === player.id) return { ok: false, error: "You cannot kick yourself" };
		if (target.isSuperAdmin && !player.isSuperAdmin) return { ok: false, error: `You are not allowed to kick ${target.name}` };
		let reason = args.slice(1).join(" ");
		if (!reason) { reason = `${player.name}` };
		room.kickPlayer(target.id, reason, false);
		util.messageAdmins(`${player.name} kicked ${target.name}. Reason: ${reason}`);
		return { ok: true };
	}
});
commandManager.registerCommand({
	name: "ban", category: "security", helpStrings: [".ban [player] [reason]: bans a player"], minArguments: 1, cooldownSeconds: 3, needsAdmin: true, needsSuperAdmin: false,
	execute: (player, args) => {
		const target = playerManager.getByQuery(args[0]);
		if (!target) return { ok: false, error: "Player not found" };
		if (target.id === player.id) return { ok: false, error: "You cannot ban yourself" };
		if (target.isSuperAdmin && !player.isSuperAdmin) return { ok: false, error: `You are not allowed to ban ${target.name}` };
		let reason = args.slice(1).join(" ");
		if (!reason) { reason = `${player.name}` };
		room.kickPlayer(target.id, reason, true);
		util.messageAdmins(`${player.name} banned ${target.name}. Reason: ${reason}`);
		return { ok: true };
	}
});
commandManager.registerCommand({
	name: "clearban", category: "security", helpStrings: [".clearban [id]: removes the ban for the given id", ".clearban all: removes all bans"], minArguments: 1, cooldownSeconds: 3, needsAdmin: true, needsSuperAdmin: false,
	execute: (player, args) => {
		if (args[0] === "all") {
			room.clearBans();
			util.messageAdmins(`${player.name} cleared all bans`);
		} else {
			const targetId = parseInt(args[0]);
			if (isNaN(targetId)) { return { ok: false, error: "Invalid ID" } }
			const targetBan = gameManager.recentBans.find(x => x.id === targetId);
			if (!targetBan) { return { ok: false, error: `Ban with ID ${targetId} not found` } }
			room.clearBan(targetBan.id);
			util.messageAdmins(`${player.name} cleared ban for ${targetBan.name}`);
		}
		return { ok: true };
	}
});
commandManager.registerCommand({
	name: "showban", category: "security", helpStrings: [".showban [id]: shows a specific ban", ".showban all [num]: shows last N bans"], minArguments: 1, cooldownSeconds: 3, needsAdmin: true, needsSuperAdmin: false,
	execute: (player, args) => {
		if (args[0] === "all") {
			const numBans = parseInt(args[1]);
			if (isNaN(numBans)) { return { ok: false, error: "Invalid number of bans" } }
			if (numBans > 25) { return { ok: false, error: "Number of bans must be less than 25" } }
			const recentBans = gameManager.recentBans.slice(0, numBans);
			for (const ban of recentBans) {
				util.pm(player, `(#${ban.id}) ${ban.name}, Reason: ${ban.reason}, Banned by: ${ban.by_name}`, "info");
			}
		} else {
			const targetId = parseInt(args[0]);
			if (isNaN(targetId)) { return { ok: false, error: "Invalid ID" } }
			const targetBan = gameManager.recentBans.find(x => x.id === targetId);
			if (!targetBan) { return { ok: false, error: `Ban with ID ${targetId} not found` } }
			util.pm(player, `(#${targetBan.id}) ${targetBan.name}, Reason: ${targetBan.reason}, Banned by: ${targetBan.by_name}`, "info");
		}
		return { ok: true };
	}
});
commandManager.registerCommand({
	name: "stop", category: "game", helpStrings: [".stop: stops the game"], minArguments: 0, cooldownSeconds: 3, needsAdmin: true, needsSuperAdmin: false,
	execute: async (player, args) => {
		room.stopGame();
		gameManager.timers.startTimer = setTimeout(room.startGame, 60000);
		return { ok: true, announce: `Game stopped by ${player.name}, it will start in 60 seconds` };
	}
});
commandManager.registerCommand({
	name: "start", category: "game", helpStrings: [".start: starts the game"], minArguments: 0, cooldownSeconds: 3, needsAdmin: true, needsSuperAdmin: false,
	execute: async (player, args) => {
		room.startGame();
		if (gameManager.timers.startTimer) clearTimeout(gameManager.timers.startTimer);
		return { ok: true, announce: `Game started by ${player.name}` };
	}
});
commandManager.registerCommand({
	name: "restart", category: "game", helpStrings: [".start: starts the game"], minArguments: 0, cooldownSeconds: 3, needsAdmin: true, needsSuperAdmin: false,
	execute: async (player, args) => {
		room.stopGame();
		util.sleep(500);
		room.startGame();
		if (gameManager.timers.startTimer) clearTimeout(gameManager.timers.startTimer);
		return { ok: true, announce: `Game restarted by ${player.name}` };
	}
});
commandManager.registerCommand({
	name: "pause", category: "game", helpStrings: [".pause: pauses / unpauses the game"], minArguments: 0, cooldownSeconds: 3, needsAdmin: true, needsSuperAdmin: false,
	execute: async (player, args) => {
		gameManager.isGamePaused = !gameManager.isGamePaused;
		if (gameManager.isGamePaused) {
			gameManager.pauseTheGame(true);
			const nSeconds = 30;
			util.say(`Game will resume in ${nSeconds} seconds`);
			gameManager.timers.unpauseTimer = setTimeout(() => { gameManager.pauseTheGame(false); }, nSeconds * 1000);
			return { ok: true, announce: `Game paused by ${player.name}` };
		} else {
			gameManager.pauseTheGame(false);
			if (gameManager.timers.unpauseTimer) clearTimeout(gameManager.timers.unpauseTimer);
			return { ok: true, announce: `Game resumed by ${player.name}` };
		}
	}
});
commandManager.registerCommand({
	name: "map", category: "game", helpStrings: [".map: shows list of stadiums", ".map [map]: changes the stadium"], minArguments: 0, cooldownSeconds: 3, needsAdmin: true, needsSuperAdmin: false,
	execute: async (player, args) => {
		if (!args.length) {
			return { ok: true, info: gameManager.stadiums.data.map(x => x.name).join(", ") }
		} else {
			const targetStadium = gameManager.stadiums.data.find(x => x.name.toLocaleLowerCase().includes(args.join(" ").toLocaleLowerCase()));
			if (!targetStadium) {
				return { ok: false, error: "Stadium not found" }
			}
			gameManager.stadiums.selectedStadiumName = targetStadium.name;
			gameManager.stadiums.currentStadiumMessage = targetStadium.m;
			const teamCaps = [targetStadium.t[0], targetStadium.t[1]];
			if (teamCaps && teamCaps.length == 2) {
				gameManager.changeTeamCaps(teamCaps[0], teamCaps[1]);
			}
			room.stopGame();
			util.sleep(500);
			let hbs = targetStadium["hbs"];
			if (typeof hbs !== "string") {
				targetStadium["hbs"] = hbs = JSON.stringify(hbs);
			}
			await room.setCustomStadium(hbs);
			if (targetStadium.m && targetStadium.m.length) {
				util.say(targetStadium.m);
			}
			util.sleep(500);
			room.startGame();
			if (gameManager.timers.startTimer) clearTimeout(gameManager.timers.startTimer);
			return { ok: true, announce: `Stadium changed to ${targetStadium.name} by ${player.name}` }
		}
	}
});
commandManager.registerCommand({
	name: "kits", category: "game", helpStrings: [".kits: shows available kits", ".kits [id / name]: changes the kits"], minArguments: 0, cooldownSeconds: 3, needsAdmin: true, needsSuperAdmin: false,
	execute: async (player, args) => {
		if (!args.length) { // list kits
			gameManager.kits.data.forEach((kit, index) => {
				util.pm(player, `${index}: ${kit._kname}`, "info");
			});
			return { ok: true }
		} else {
			let selectedKitId, selectedKit: any;
			const kitQuery = args[0];
			if (kitQuery === "print") {
				const ck = gameManager.kits.data[gameManager.kits.selectedKitId];
				util.pm(player, `Kit Name: '${ck["_kname"]}'`, "info");
				ck.colors.forEach((x: any) => util.pm(player, `/colors ${x[0] === 1 ? 'red' : 'blue'} ${x[1]} ${x[2].toString(16)} ${x[3].map((a: any) => a.toString(16)).join(' ')}`, "info"));
				ck.colors.forEach((x: any) => util.pm(player, `room.setTeamColors(${x[0]},${x[1]},0x${x[2].toString(16)},[${x[3].map((a: any) => '0x' + a.toString(16)).join(',')}]);`, "info"));
				return { ok: true }
			}
			const kitId = parseInt(kitQuery);
			if (!isNaN(kitId) && kitId >= 0 && kitId < gameManager.kits.data.length) {
				selectedKitId = kitId;
				selectedKit = gameManager.kits.data[kitId];
			} else {
				if (kitQuery === "random") {
					selectedKitId = Math.floor(Math.random() * gameManager.kits.data.length);
				} else {
					selectedKitId = gameManager.kits.data.findIndex(x => x._kname.toLocaleLowerCase().includes(kitQuery.toLocaleLowerCase()));
				}
				if (selectedKitId === -1) {
					return { ok: false, error: "Kit not found" };
				}
				selectedKit = gameManager.kits.data[selectedKitId];
			}
			//apply kit
			gameManager.kits.selectedKitId = selectedKitId;
			room.setTeamColors(...selectedKit.colors[0]);
			room.setTeamColors(...selectedKit.colors[1]);
			return { ok: true, announce: `${player.name} changed kits to #${selectedKitId} ${selectedKit._kname}` }
		}
	}
});
commandManager.registerCommand({
	name: "afk", category: "teams", helpStrings: [".afk: sets your afk status", ".afk [player]: sets another player's afk status"], minArguments: 0, cooldownSeconds: 10, needsAdmin: false, needsSuperAdmin: false,
	execute: async (player, args) => {
		let targetPlayer = player;
		if (args.length) {
			const findTargetPlayer = playerManager.getByQuery(args[0]);
			if (findTargetPlayer) {
				targetPlayer = findTargetPlayer;
			} else {
				return { ok: false, error: "Player not found" };
			}
		}
		if (targetPlayer.isAfk) {
			return { ok: true, warning: `${targetPlayer.name} is already AFK` };
		} else {
			await playerManager.setAfk(targetPlayer, true);
			if (targetPlayer.id === player.id) {
				util.say(`${targetPlayer.name} is now AFK`);
			} else {
				util.say(`${targetPlayer.name} is now AFK (Set by ${player.name})`);
			}
			await balancing.reorderSpecs();
			await balancing.balanceTeamsWithTimeout(500);
			return { ok: true };
		}
	}
});
commandManager.registerCommand({
	name: "back", category: "teams", helpStrings: [".back: removes your afk status", ".back [player]: removes another player's afk status"], minArguments: 0, cooldownSeconds: 10, needsAdmin: false, needsSuperAdmin: false,
	execute: async (player, args) => {
		let targetPlayer = player;
		if (args.length) {
			const findTargetPlayer = playerManager.getByQuery(args[0]);
			if (findTargetPlayer) {
				targetPlayer = findTargetPlayer;
			} else {
				return { ok: false, error: "Player not found" };
			}
		}
		if (!targetPlayer.isAfk) {
			return { ok: true, warning: `${targetPlayer.name} is not AFK` };
		} else {
			await playerManager.setAfk(targetPlayer, false);
			if (targetPlayer.id === player.id) {
				util.say(`${targetPlayer.name} is back`);
			} else {
				util.say(`${targetPlayer.name} is back (Set by ${player.name})`);
			}
			await balancing.reorderSpecs();
			await balancing.balanceTeamsWithTimeout(500);
			return { ok: true };
		}
	}
});
commandManager.registerCommand({
	name: "mix", category: "teams", helpStrings: [".mix: mixes the teams"], minArguments: 0, cooldownSeconds: 3, needsAdmin: true, needsSuperAdmin: false,
	execute: async (player, args) => {
		playerManager.red.forEach(async (p) => {
			await playerManager.movePlayerToTeam(p, 0);
			p.spectatingSince = new Date(Math.floor(Math.random() * 1000));
		});
		playerManager.blue.forEach(async (p) => {
			await playerManager.movePlayerToTeam(p, 0);
			p.spectatingSince = new Date(Math.floor(Math.random() * 1000));
		});
		await balancing.balanceTeamsWithTimeout(1000);
		return { ok: true, announce: `${player.name} mixed the teams` };
	}
});
commandManager.registerCommand({
	name: "remix", category: "teams", helpStrings: [".remix: mixes the teams and restarts the game"], minArguments: 0, cooldownSeconds: 3, needsAdmin: true, needsSuperAdmin: false,
	execute: async (player, args) => {
		room.stopGame();
		playerManager.red.forEach(async (p) => {
			await playerManager.movePlayerToTeam(p, 0);
			p.spectatingSince = new Date(Math.floor(Math.random() * 1000));
		});
		playerManager.blue.forEach(async (p) => {
			await playerManager.movePlayerToTeam(p, 0);
			p.spectatingSince = new Date(Math.floor(Math.random() * 1000));
		});
		await balancing.balanceTeamsWithTimeout(1000);
		room.startGame();
		return { ok: true, announce: `${player.name} mixed the teams` };
	}
});
commandManager.registerCommand({
	name: "red", category: "teams", helpStrings: [".red [player]: moves a player to red team"], minArguments: 1, cooldownSeconds: 1, needsAdmin: true, needsSuperAdmin: false,
	execute: async (player, args) => {
		const targetPlayer = playerManager.getByQuery(args[0]);
		if (!targetPlayer) return { ok: false, error: "Player not found" };
		await playerManager.movePlayerToTeam(targetPlayer, 1);
		await balancing.balanceTeamsWithTimeout(500);
		return { ok: true, announce: `${targetPlayer.name} moved to red team by ${player.name}` };
	}
});
commandManager.registerCommand({
	name: "blue", category: "teams", helpStrings: [".blue [player]: moves a player to blue team"], minArguments: 1, cooldownSeconds: 1, needsAdmin: true, needsSuperAdmin: false,
	execute: async (player, args) => {
		const targetPlayer = playerManager.getByQuery(args[0]);
		if (!targetPlayer) return { ok: false, error: "Player not found" };
		await playerManager.movePlayerToTeam(targetPlayer, 2);
		await balancing.balanceTeamsWithTimeout(500);
		return { ok: true, announce: `${targetPlayer.name} moved to blue team by ${player.name}` };
	}
});
commandManager.registerCommand({
	name: "spec", category: "teams", helpStrings: [".spec [player]: moves a player to spectator team"], minArguments: 1, cooldownSeconds: 1, needsAdmin: true, needsSuperAdmin: false,
	execute: async (player, args) => {
		const targetPlayer = playerManager.getByQuery(args[0]);
		if (!targetPlayer) return { ok: false, error: "Player not found" };
		await playerManager.movePlayerToTeam(targetPlayer, 0);
		targetPlayer.spectatingSince = new Date();
		await balancing.balanceTeamsWithTimeout(500);
		return { ok: true, announce: `${targetPlayer.name} moved to spectators by ${player.name}` };
	}
});
commandManager.registerCommand({
	name: "swap", category: "teams", helpStrings: [".swap [player1] [player2]: swaps two players' teams"], minArguments: 2, cooldownSeconds: 1, needsAdmin: true, needsSuperAdmin: false,
	execute: async (player, args) => {
		const p1 = playerManager.getByQuery(args[0]);
		if (!p1) return { ok: false, error: `Player not found: ${args[0]}` };
		const p2 = playerManager.getByQuery(args[1]);
		if (!p2) return { ok: false, error: `Player not found: ${args[1]}` };
		if (p1.id === p2.id) return { ok: false, error: "Two players cannot be the same" };
		if (p1.isAfk || p2.isAfk) return { ok: false, error: "One of the players is AFK" };
		if (p1.team === p2.team) return { ok: false, error: "Players must be on different teams" };
		const p1Team = p1.team;
		const p2Team = p2.team;
		await playerManager.movePlayerToTeam(p1, p2Team);
		await playerManager.movePlayerToTeam(p2, p1Team);
		//await balancing.balanceTeamsWithTimeout(500);
		return { ok: true, announce: `${player.name} swapped ${p1.name} and ${p2.name}` };
	}
});
commandManager.registerCommand({
	name: "balance", category: "teams", helpStrings: [".balance: balances teams"], minArguments: 0, cooldownSeconds: 3, needsAdmin: true, needsSuperAdmin: false,
	execute: async (player, args) => {
		await balancing.balanceTeamsWithTimeout(500);
		return { ok: true, announce: `Teams balanced (by ${player.name})` };
	}
});
commandManager.registerCommand({
	name: "say", category: "chat", helpStrings: [".say [message]: Announce a message"], minArguments: 1, cooldownSeconds: 1, needsAdmin: true, needsSuperAdmin: false,
	execute: (player, args) => {
		const message = args.join(" ");
		if (!message || !message.length) { return { ok: false, error: "Message cannot be empty" } }
		return { ok: true, announce: `${player.name}: ${message}` };
	}
});
commandManager.registerCommand({
	name: "sayanon", category: "chat", helpStrings: [".sayanon [message]: Announce a message anonymously"], minArguments: 1, cooldownSeconds: 1, needsAdmin: true, needsSuperAdmin: true,
	execute: (player, args) => {
		const message = args.join(" ");
		if (!message || !message.length) { return { ok: false, error: "Message cannot be empty" } }
		return { ok: true, announce: `${message}` };
	}
});
commandManager.registerCommand({
	name: "teamchat", category: "chat", helpStrings: [".team [message]: sends a message to your team"], minArguments: 1, cooldownSeconds: 5, needsAdmin: false, needsSuperAdmin: false,
	execute: (player, args) => {
		const message = args.join(" ");
		if (!message || !message.length) { return { ok: false, error: "Message cannot be empty" } }
		//const team = player.team === 0 ? playerManager.spectators : player.team === 1 ? playerManager.red : playerManager.blue;
		const teamName = player.team === 0 ? "spectators" : player.team === 1 ? "red" : "blue";
		const team = playerManager[teamName];
		team.forEach(p => { room.sendAnnouncement(`${player.name} -> ${teamName}: ${message}`, p.id, teamName === "red" ? Config.colors.red : teamName === "blue" ? Config.colors.blue : Config.colors.gray) });
		return { ok: true };
	}
});
commandManager.registerCommand({
	name: "mute", category: "chat", helpStrings: [".mute [player] [minutes]: mutes a player for N minutes"], minArguments: 2, cooldownSeconds: 1, needsAdmin: true, needsSuperAdmin: false,
	execute: (player, args) => {
		const targetPlayer = playerManager.getByQuery(args[0]);
		if (!targetPlayer) return { ok: false, error: "Player not found" };
		if (targetPlayer.id === player.id) return { ok: false, error: "You cannot mute yourself" };
		if (targetPlayer.isSuperAdmin && !player.isSuperAdmin) return { ok: false, error: `You are not allowed to mute ${targetPlayer.name}` };
		const minutes = parseFloat(args[1]);
		if (isNaN(minutes) || minutes <= 0 || minutes > 30) return { ok: false, error: "Invalid minutes" };
		targetPlayer.chatMutedUntil = new Date(Date.now() + minutes * 60 * 1000);
		util.say(`🔕 ${targetPlayer.name} is muted for ${minutes} minutes by ${player.name}`);
		return { ok: true };
	}
});
commandManager.registerCommand({
	name: "unmute", category: "chat", helpStrings: [".unmute [player]: unmutes a player"], minArguments: 1, cooldownSeconds: 1, needsAdmin: true, needsSuperAdmin: false,
	execute: (player, args) => {
		const targetPlayer = playerManager.getByQuery(args[0]);
		if (!targetPlayer) return { ok: false, error: "Player not found" };
		targetPlayer.chatMutedUntil = new Date(0);
		util.say(`✔️ ${targetPlayer.name} is unmuted by ${player.name}`);
		return { ok: true };
	}
});

commandManager.registerCommand({
	name: "muteall", category: "chat", helpStrings: [".muteall [minutes]: mutes everyone for N minutes"], minArguments: 1, cooldownSeconds: 1, needsAdmin: true, needsSuperAdmin: false,
	execute: (player, args) => {
		const minutes = parseInt(args[0]);
		if (isNaN(minutes) || minutes <= 0 || minutes > 30) return { ok: false, error: "Invalid minutes" };
		playerManager.all.forEach((p: Player) => {
			if (p.isSuperAdmin) { return; }
			p.chatMutedUntil = new Date(Date.now() + minutes * 60 * 1000);
		});
		util.say(`🔕 Everyone is muted for ${minutes} minutes by ${player.name}`);
		return { ok: true };
	}
});
commandManager.registerCommand({
	name: "unmuteall", category: "chat", helpStrings: [".unmuteall: unmutes everyone"], minArguments: 0, cooldownSeconds: 1, needsAdmin: true, needsSuperAdmin: false,
	execute: (player, args) => {
		playerManager.all.forEach((p: Player) => {
			if (p.isSuperAdmin) { return; }
			p.chatMutedUntil = new Date(0);
		});
		util.say(`✔️ Everyone is unmuted by ${player.name}`);
		return { ok: true };
	}
});
commandManager.registerCommand({
	name: "elo", category: "chat", helpStrings: [".elo: shows your Elo", ".elo [player]: shows another player's Elo"], minArguments: 0, cooldownSeconds: 5, needsAdmin: false, needsSuperAdmin: false,
	execute: (player, args) => {
		let targetPlayer;
		if (args.length) {
			targetPlayer = playerManager.getByQuery(args[0]);
			if (!targetPlayer) return { ok: false, error: "Player not found" };
		} else {
			targetPlayer = player;
		}
		return { ok: true, info: `${targetPlayer.name}'s Elo is ${targetPlayer.elo}` };
	}
});
commandManager.registerCommand({
	name: "eval", category: "utility", helpStrings: [".eval [code]"], minArguments: 1, cooldownSeconds: 3, needsAdmin: true, needsSuperAdmin: true,
	execute: (player, args) => {
		const codeToRun = args.join(" ");
		const fEval = (code: string, ctx: any) => (new Function("with(this) { return " + code + " }")).call(ctx);
		try {
			const ctx = Object.assign(
				Object.create(globalThis), // fall through to all real globals
				{ player, args, room, util, commandManager } // fill in module-scoped stuff too
			);
			const result = fEval(codeToRun, ctx);
			//return { ok: true, success: result ? util.variableToString(result) : null };
			return { ok: true, success: util.variableToString(result) };
		} catch (e) {
			return { ok: false, error: util.variableToString(e) };
		}
	}
});
commandManager.registerCommand({
	name: "get", category: "utility", helpStrings: [".get [varName]: shows the value of a parameter", "possible values: captainmode, autobalance, forceequalteams, password, captcha, teams, autopassword, afkdetector"], minArguments: 1, cooldownSeconds: 3, needsAdmin: true, needsSuperAdmin: false,
	execute: async (player, args) => {
		let targetVariable: any;
		let varName = args[0];
		switch (varName) {
			case "captainmode":
				targetVariable = gameManager.captainMode;
				break;
			case "autobalance":
				targetVariable = gameManager.autoBalance;
				break;
			case "et":
			case "equalteams":
			case "forceequalteams":
				targetVariable = gameManager.forceEqualTeams;
				break;
			case "password":
				targetVariable = gameManager.roomPassword;
				break;
			case "captcha":
				targetVariable = gameManager.captcha;
				break;
			case "blocknewtab":
				targetVariable = gameManager.blockNewTab;
				break;
			case "team":
				switch (args[1]) {
					case "red":
						targetVariable = Array.from(playerManager.red).map(p => p.name).join(", ");
						break;
					case "blue":
						targetVariable = Array.from(playerManager.blue).map(p => p.name).join(", ");
						break;
					case "spec":
						targetVariable = Array.from(playerManager.spectators).map(p => p.name).join(", ");
						break;
					case "afk":
						targetVariable = Array.from(playerManager.afks).map(p => p.name).join(", ");
						break;
					default:
						return { ok: false, error: "Invalid team name. Use red, blue or spec." };
				}
				varName = args[1];
				break;
			case "teams":
			case "teamcaps":
				return { ok: true, info: `Teams mode: ${gameManager.teamCaps.red}v${gameManager.teamCaps.blue}` };
			case "autopassword":
				targetVariable = gameManager.autoPasswordCapacity;
				break;
			case "afkdetector":
				targetVariable = gameManager.isTrackingAfks;
				break;
			default:
				return { ok: false, error: "Invalid variable name" };
		}
		return { ok: true, info: `${varName}: ${util.variableToString(targetVariable)}` };
	}
});
commandManager.registerCommand({
	name: "set", category: "utility", helpStrings: [".set [varName] [value]: sets the value of a parameter", "for possible varNames: type .help get"], minArguments: 2, cooldownSeconds: 3, needsAdmin: true, needsSuperAdmin: false,
	execute: async (player, args) => {
		const varName = args[0];
		const newValue = args[1];
		let outputValue: any;
		switch (varName) {
			case "captainmode":
				outputValue = gameManager.captainMode = util.parseBoolean(newValue, false);
				await balancing.balanceTeamsWithTimeout(500);
				break;
			case "autobalance":
				outputValue = gameManager.autoBalance = util.parseBoolean(newValue, true);
				await balancing.balanceTeamsWithTimeout(500);
				break;
			case "et":
			case "equalteams":
			case "forceequalteams":
				outputValue = gameManager.forceEqualTeams = util.parseBoolean(newValue, false);
				await balancing.balanceTeamsWithTimeout(500);
				break;
			case "password":
				// const isPasswordOn = util.parseBoolean(newValue, false);
				// outputValue = isPasswordOn ? newValue : null;
				// util.setRoomPassword(outputValue);
				if (util.parseFalse(newValue)) {
					outputValue = null;
				} else {
					outputValue = newValue
				}
				util.setRoomPassword(outputValue);
				break;
			case "captcha":
				outputValue = gameManager.captcha = util.parseBoolean(newValue, false);
				room.setRequireRecaptcha(outputValue)
				break;
			case "blocknewtab":
				outputValue = gameManager.blockNewTab = util.parseBoolean(newValue, false);
				break;
			case "teams":
			case "teamcaps":
				const inputArray = args[1].split("v").map((v) => parseInt(v));
				if (inputArray.length !== 2 || isNaN(inputArray[0]) || isNaN(inputArray[1])) {
					return { ok: false, error: "Invalid team caps format. Use [red]v[blue] format" };
				}
				outputValue = await gameManager.changeTeamCaps(inputArray[0], inputArray[1]);
				util.say(`Team caps changed to ${outputValue} (by ${player.name})`);
				return { ok: true };
			case "autopassword":
				const maxPlayers = parseInt(newValue);
				if (isNaN(maxPlayers) || maxPlayers < 0) {
					return { ok: false, error: "Invalid number" };
				}
				outputValue = gameManager.autoPasswordCapacity = maxPlayers;
				break;
			case "afkdetector":
				outputValue = util.parseTrue(newValue);
				util.messageAdmins(`ℹ️ ${player.name} ${outputValue ? "enabled" : "disabled"} AFK tracking`);
				gameManager.setAfkTracking(outputValue)
				break;
			default:
				return { ok: false, error: "Invalid variable name" };
		}
		util.messageAdmins(`${player.name} set ${varName} = ${util.variableToString(outputValue)}`);
		return { ok: true };
	}
});
commandManager.registerCommand({
	name: "list", category: "utility", helpStrings: [".list admins / superadmins / developers / afks"], minArguments: 1, cooldownSeconds: 5, needsAdmin: false, needsSuperAdmin: false,
	execute: (player, args) => {
		switch (args[0]) {
			case "admins":
				if (!player.isAdmin) { return { ok: false, error: "You are not admin" }; }
				const admins = Array.from(playerManager.admins).map(p => p.name);
				if (admins.length === 0) {
					return { ok: false, error: "No admins found" };
				}
				return { ok: true, info: `Admins: ${admins.join(", ")}` };
			case "superadmins":
				if (!player.isSuperAdmin) { return { ok: false, error: "You are not super admin" }; }
				const superadmins = Array.from(playerManager.superAdmins).map(p => p.name);
				if (superadmins.length === 0) {
					return { ok: false, error: "No super admins found" };
				}
				return { ok: true, info: `Super admins: ${superadmins.join(", ")}` };
			case "devs":
			case "developers":
				if (!player.isSuperAdmin) { return { ok: false, error: "You are not super admin" }; }
				const developers = Array.from(playerManager.developers).map(p => p.name);
				if (developers.length === 0) {
					return { ok: false, error: "No developers found" };
				}
				return { ok: true, info: `Developers: ${developers.join(", ")}` };
			case "afks":
				const afks = Array.from(playerManager.afks).map(p => p.name);
				if (afks.length === 0) {
					return { ok: false, error: "No AFKs found" };
				}
				return { ok: true, info: `AFKs: ${afks.join(", ")}` };
			default:
				return { ok: false, error: "Invalid argument. Use admins, superadmins, developers or afks" };
		}
	}
});
import { gameManager, room } from "./GameManager";
import * as util from "./util";
import { playerManager, Player, VanillaPlayer } from "./PlayerManager";
import * as balancing from './balancing'

export interface Command {
	name: string;
	helpStrings: string[];
	minArguments: number;
	cooldownSeconds: number;
	needsAdmin: boolean;
	needsSuperAdmin: boolean;
	execute: (player: Player, args: string[]) => CommandResult | Promise<CommandResult>; // sync | async

}
interface CommandParseResult {
	caller: Player;
	isCommandFound: boolean;
	command: Command | null;
	commandName: string;
	args: string[];
}
export type CommandResult =
	| { ok: true; success?: any, info?: string, warning?: string }
	| { ok: false; error?: string; needsHelp?: boolean, success?: any, info?: string, warning?: string };

export class CommandManager {
	//public commands: Command[];
	public commands: Record<string, Command>;
	public commandAliases: Record<string, string>;
	constructor() {
		this.commands = {};
		this.commandAliases = {
			"ta": "toggle_admin",
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
			isCommandFound: false,
			command: null,
			commandName: cmd,
			args: []
		}
		let command: Command = this.commands[cmd];
		if (!command) {
			command = this.commands[this.commandAliases[cmd]];
		}
		if (command) {
			parseResult.isCommandFound = true;
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
		util.debugLog(`${caller.name}: .${command.name} ${args.join(" ")}`);
		try {
			return await command.execute(caller, args);
		} catch (commandException) {
			util.debugLog(`executeCommand: command failed for player ${caller.name} #${caller.id}`);
			util.debugLog(commandException);
			return { ok: false, error: "Command exception" };
		}
	}
	async parseAndExecuteCommand(player: Player, message: string): Promise<void> {
		//util.debugLog(`${player.name}: ${message}`);
		util.messageDevelopers(`${player.name}: ${message}`);
		const parseResult = this.parseCommandInputs(player, message.substring(1));
		if (!parseResult.isCommandFound) {
			util.pm(player, `.${parseResult.commandName}: command not found`, "error");
			return;
		}
		if (parseResult.command && parseResult.args.length < parseResult.command.minArguments) {
			util.pm(player, `Too few arguments. Use .help ${parseResult.command.name}`, "error");
			return;
		}
		const result = await this.executeCommand(parseResult);
		console.log("commandResult = " + util.variableToString(result));
		if (!result.ok) {
			if (result.error) {
				util.pm(player, result.error, "error");
			}
			if (result.needsHelp) {
				const commandName = parseResult.command?.name || "";
				util.pm(player, `For help type .help ${commandName}`, "error");
			}
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
	}

} // class CommandManager
export const commandManager = new CommandManager();
commandManager.registerCommand({
	name: "help", helpStrings: ["Get help"], minArguments: 0, cooldownSeconds: 5, needsAdmin: false, needsSuperAdmin: false, execute: (player, args) => {
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
			const commandList = Object.values(commandManager.commands)
				.map(c => `.${c.name}`)
				.join(" ");
			util.pm(player, `Commands: ${commandList}`);
			return { ok: true };
		}
	}
});
commandManager.registerCommand({
	name: "version", helpStrings: ["Get bot version"], minArguments: 0, cooldownSeconds: 5, needsAdmin: false, needsSuperAdmin: false,
	execute: (player, args) => {
		//util.pm(player, `Version: ${__BOT_VERSION__}`);
		return { ok: true, info: `Version: ${__BOT_VERSION__}` };
	}
});
commandManager.registerCommand({
	name: "get", helpStrings: [".get [variableName]: shows the value of a parameter"], minArguments: 1, cooldownSeconds: 3, needsAdmin: true, needsSuperAdmin: false,
	execute: (player, args) => {
		let targetVariable: any;
		const variableName = args[0];
		switch (variableName) {
			case "captainmode":
				targetVariable = gameManager.captainMode;
				break;
			case "autobalance":
				targetVariable = gameManager.autoBalance;
				break;
			case "forceequalteams":
				targetVariable = gameManager.forceEqualTeams;
				break;
			case "password":
				targetVariable = gameManager.roomPassword;
				break;
			default:
				return { ok: false, error: "Invalid variable name" };
		}
		return { ok: true, info: `${variableName}: ${util.variableToString(targetVariable)}` };
	}
});
commandManager.registerCommand({
	name: "set", helpStrings: [".set [variableName] [value]: sets the value of a parameter"], minArguments: 2, cooldownSeconds: 3, needsAdmin: true, needsSuperAdmin: false,
	execute: async (player, args) => {
		let targetVariable: any;
		const variableName = args[0];
		const newValue = args[1];
		switch (variableName) {
			case "captainmode":
				gameManager.captainMode = util.parseBoolean(newValue, false);
				await balancing.balanceTeamsWithTimeout(500);
				break;
			case "autobalance":
				gameManager.autoBalance = util.parseBoolean(newValue, true);
				await balancing.balanceTeamsWithTimeout(500);
				break;
			case "forceequalteams":
				gameManager.forceEqualTeams = util.parseBoolean(newValue, false);
				await balancing.balanceTeamsWithTimeout(500);
				break;
			case "password":
				const isPasswordOn = util.parseBoolean(newValue, false);
				util.setRoomPassword(isPasswordOn ? newValue : null);
				break;
			default:
				return { ok: false, error: "Invalid variable name" };
		}
		util.messageAdmins(`${player.name} set ${variableName} = ${util.variableToString(targetVariable)}`);
		return { ok: true };
	}
});
commandManager.registerCommand({
	name: "admin", helpStrings: [".admin [password]: Get admin privileges"], minArguments: 1, cooldownSeconds: 5, needsAdmin: false, needsSuperAdmin: false,
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
	name: "promote", helpStrings: [".promote [player] admin / superadmin / dev: promote a player to admin"], minArguments: 2, cooldownSeconds: 3, needsAdmin: true, needsSuperAdmin: false,
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
			return { ok: true, info: `You promoted ${targetPlayer.name} to admin` };
		}
		if (player.isSuperAdmin && rank === "superadmin") {
			if (targetPlayer.isSuperAdmin) {
				return { ok: false, error: `${targetPlayer.name} is already super admin` };
			}
			playerManager.setSuperAdmin(targetPlayer, true);
			return { ok: true, info: `You promoted ${targetPlayer.name} to super admin` };
		}
		if (player.isSuperAdmin && rank === "dev") {
			if (targetPlayer.isDeveloper) {
				return { ok: false, error: `${targetPlayer.name} is already developer` };
			}
			playerManager.setDeveloper(targetPlayer, true);
			return { ok: true, info: `You promoted ${targetPlayer.name} to developer` };
		}
		return { ok: false, error: "Invalid rank" };
	}
});
commandManager.registerCommand({
	name: "demote", helpStrings: [".demote [player]: demote a player"], minArguments: 1, cooldownSeconds: 3, needsAdmin: true, needsSuperAdmin: false,
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
	name: "toggle_admin", helpStrings: [".toggle_admin: toggles your admin visibility", ".toggle_admin [player]: toggles admin visibility of another player"], minArguments: 0, cooldownSeconds: 3, needsAdmin: true, needsSuperAdmin: true,
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
		return { ok: true, success: `${targetPlayer.name}'s admin visibility toggled` };
	}
});
commandManager.registerCommand({
	name: "afk", helpStrings: [".afk: sets your afk status", ".afk [player]: sets another player's afk status"], minArguments: 0, cooldownSeconds: 10, needsAdmin: false, needsSuperAdmin: false,
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
			util.say(`${targetPlayer.name} is now AFK`);
			//await balancing.reorderSpecs();
			await balancing.balanceTeamsWithTimeout(1000);
			return { ok: true };
		}
	}
});
commandManager.registerCommand({
	name: "back", helpStrings: [".back: removes your afk status", ".back [player]: removes another player's afk status"], minArguments: 0, cooldownSeconds: 10, needsAdmin: false, needsSuperAdmin: false,
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
			util.say(`${targetPlayer.name} is no longer AFK`);
			await balancing.balanceTeamsWithTimeout(1000);
			return { ok: true };
		}
	}
});
commandManager.registerCommand({
	name: "mix", helpStrings: [".mix: mixes the teams"], minArguments: 0, cooldownSeconds: 3, needsAdmin: true, needsSuperAdmin: false,
	execute: async (player, args) => {
		playerManager.redTeam.forEach(async (p) => {
			await playerManager.movePlayerToTeam(p, 0);
			p.spectatingSince = new Date(Math.floor(Math.random() * 1000));
		});
		playerManager.blueTeam.forEach(async (p) => {
			await playerManager.movePlayerToTeam(p, 0);
			p.spectatingSince = new Date(Math.floor(Math.random() * 1000));
		});
		await balancing.balanceTeamsWithTimeout(1000);
		util.say(`${player.name} mixed the teams`);
		return { ok: true };
	}
});
commandManager.registerCommand({
	name: "pause", helpStrings: [".pause: pauses / unpauses the game"], minArguments: 0, cooldownSeconds: 3, needsAdmin: true, needsSuperAdmin: false,
	execute: async (player, args) => {
		gameManager.isGamePaused = !gameManager.isGamePaused;
		if (gameManager.isGamePaused) {
			room.pauseGame(true);
			util.say("Game paused by " + player.name);
			return { ok: true };
		} else {
			room.pauseGame(false);
			util.say("Game resumed by " + player.name);
			return { ok: true };
		}
	}
});
commandManager.registerCommand({
	name: "red", helpStrings: [".red [player]: moves a player to red team"], minArguments: 1, cooldownSeconds: 1, needsAdmin: true, needsSuperAdmin: false,
	execute: async (player, args) => {
		const targetPlayer = playerManager.getByQuery(args[0]);
		if (!targetPlayer) return { ok: false, error: "Player not found" };
		await playerManager.movePlayerToTeam(targetPlayer, 1);
		await balancing.balanceTeamsWithTimeout(500);
		return { ok: true };
	}
});
commandManager.registerCommand({
	name: "blue", helpStrings: [".blue [player]: moves a player to blue team"], minArguments: 1, cooldownSeconds: 1, needsAdmin: true, needsSuperAdmin: false,
	execute: async (player, args) => {
		const targetPlayer = playerManager.getByQuery(args[0]);
		if (!targetPlayer) return { ok: false, error: "Player not found" };
		await playerManager.movePlayerToTeam(targetPlayer, 2);
		await balancing.balanceTeamsWithTimeout(500);
		return { ok: true };
	}
});
commandManager.registerCommand({
	name: "spec", helpStrings: [".spec [player]: moves a player to spectator team"], minArguments: 1, cooldownSeconds: 1, needsAdmin: true, needsSuperAdmin: false,
	execute: async (player, args) => {
		const targetPlayer = playerManager.getByQuery(args[0]);
		if (!targetPlayer) return { ok: false, error: "Player not found" };
		await playerManager.movePlayerToTeam(targetPlayer, 0);
		targetPlayer.spectatingSince = new Date();
		await balancing.balanceTeamsWithTimeout(500);
		return { ok: true };
	}
});
commandManager.registerCommand({
	name: "mute", helpStrings: [".mute [player] [minutes]: mutes a player for N minutes"], minArguments: 2, cooldownSeconds: 1, needsAdmin: true, needsSuperAdmin: false,
	execute: (player, args) => {
		const targetPlayer = playerManager.getByQuery(args[0]);
		if (!targetPlayer) return { ok: false, error: "Player not found" };
		const minutes = parseInt(args[1]);
		if (isNaN(minutes) || minutes <= 0 || minutes > 30) return { ok: false, error: "Invalid minutes" };
		targetPlayer.chatMutedUntil = new Date(Date.now() + minutes * 60 * 1000);
		util.say(`🔕 ${targetPlayer.name} is muted for ${minutes} minutes by ${player.name}`);
		return { ok: true };
	}
});
commandManager.registerCommand({
	name: "unmute", helpStrings: [".unmute [player]: unmutes a player"], minArguments: 1, cooldownSeconds: 1, needsAdmin: true, needsSuperAdmin: false,
	execute: (player, args) => {
		const targetPlayer = playerManager.getByQuery(args[0]);
		if (!targetPlayer) return { ok: false, error: "Player not found" };
		targetPlayer.chatMutedUntil = new Date(0);
		util.say(`✅ ${targetPlayer.name} is unmuted by ${player.name}`);
		return { ok: true };
	}
});

commandManager.registerCommand({
	name: "muteall", helpStrings: [".muteall [minutes]: mutes everyone for N minutes"], minArguments: 1, cooldownSeconds: 1, needsAdmin: true, needsSuperAdmin: false,
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
	name: "unmuteall", helpStrings: [".unmuteall: unmutes everyone"], minArguments: 0, cooldownSeconds: 1, needsAdmin: true, needsSuperAdmin: false,
	execute: (player, args) => {
		playerManager.all.forEach((p: Player) => {
			if (p.isSuperAdmin) { return; }
			p.chatMutedUntil = new Date(0);
		});
		util.say(`✅ Everyone is unmuted by ${player.name}`);
		return { ok: true };
	}
});
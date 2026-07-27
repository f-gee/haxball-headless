import { gameManager, room } from "./GameManager";
import * as util from "./util";
import { playerManager, Player, VanillaPlayer } from "./PlayerManager";

export interface Command {
	name: string;
	helpStrings: string[];
	minArguments: number;
	cooldownSeconds: number;
	needsAdmin: boolean;
	needsSuperAdmin: boolean;
	execute: (player: Player, args: string[]) => CommandResult | Promise<CommandResult>;

}
interface CommandParseResult {
	caller: Player;
	isCommandFound: boolean;
	command: Command | null;
	commandName: string;
	args: string[];
}
export type CommandResult =
	| { ok: true; message?: string; output?: any }
	| { ok: false; error: string; needsHelp?: boolean };

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
			util.errorPM(player, `. ${parseResult.command?.name}: command not found`);
			return;
		}
		if (parseResult.command && parseResult.args.length < parseResult.command.minArguments) {
			util.errorPM(player, `Too few arguments. Use .help ${parseResult.command.name}`);
			return;
		}
		const result = await this.executeCommand(parseResult);
		if (result.ok) {
			if (result.message) {
				util.pm(player, result.message);
			}
		} else {
			if (result.error) {
				util.debugLog(result.error);
				util.errorPM(player, result.error);
			}
			if (result.needsHelp) {
				const commandName = parseResult.command?.name || "";
				util.errorPM(player, `For help type .help ${commandName}`);
			}
		}
	}

} // class CommandManager
export const commandManager = new CommandManager();
commandManager.registerCommand({
	name: "help", helpStrings: ["Get help"], minArguments: 0, cooldownSeconds: 5, needsAdmin: false, needsSuperAdmin: false, execute: (player, args) => {
		if (args.length) {
			const commandName = args[0];
			let command = commandManager.commands[commandName];
			if (!command) {
				command = commandManager.commands[commandManager.commandAliases[commandName]];
			}
			if (!command) {
				return { ok: false, error: "Command not found" };
			}
			util.infoPM(player, `Command: .${command.name}`);
			for (const helpString of command.helpStrings) {
				util.infoPM(player, helpString);
			}
			return { ok: true };
		} else {
			const commandList = Object.values(commandManager.commands)
				.map(c => `.${c.name}`)        // simple formatting
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
		return { ok: true, message: `Version: ${__BOT_VERSION__}` };
	}
});
commandManager.registerCommand({
	name: "admin", helpStrings: [".admin [password]: Get admin privileges"], minArguments: 1, cooldownSeconds: 5, needsAdmin: false, needsSuperAdmin: false,
	execute: (player, args) => {
		const passwordInput = args[0];
		if (gameManager.adminPasswords.includes(passwordInput)) {
			playerManager.setAdmin(player, true);
			return { ok: true, message: "You are now admin" };
		}
		if (gameManager.superAdminPasswords.includes(passwordInput)) {
			playerManager.setSuperAdmin(player, true);
			return { ok: true, message: "You are super admin" };
		}
		if (gameManager.developerPasswords.includes(passwordInput)) {
			playerManager.setDeveloper(player, true);
			return { ok: true, message: "You are developer" };
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
			return { ok: true, message: `You promoted ${targetPlayer.name} to admin` };
		}
		if (player.isSuperAdmin && rank === "superadmin") {
			if (targetPlayer.isSuperAdmin) {
				return { ok: false, error: `${targetPlayer.name} is already super admin` };
			}
			playerManager.setSuperAdmin(targetPlayer, true);
			return { ok: true, message: `You promoted ${targetPlayer.name} to super admin` };
		}
		if (player.isSuperAdmin && rank === "dev") {
			if (targetPlayer.isDeveloper) {
				return { ok: false, error: `${targetPlayer.name} is already developer` };
			}
			playerManager.setDeveloper(targetPlayer, true);
			return { ok: true, message: `You promoted ${targetPlayer.name} to developer` };
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
			util.warningPM(player, `You demoted yourself ${demoteText}`);
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
		return { ok: true, message: `${targetPlayer.name}'s admin visibility toggled` };
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
		targetPlayer.isAfk = true;
		await playerManager.movePlayerToTeam(targetPlayer, 0);
		util.say(`${targetPlayer.name} is now AFK`);
		return { ok: true };
	}
});
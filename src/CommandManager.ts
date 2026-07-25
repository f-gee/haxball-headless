import type { Player } from "./types";
import { gameManager } from "./GameManager";
import * as util from "./util";
import { playerManager } from "./PlayerManager";

export interface Command {
	name: string;
	helpStrings: string[];
	minArguments: number;
	cooldownSeconds: number;
	needsAdmin: boolean;
	needsSuperAdmin: boolean;
	execute: (player: Player, args: string[]) => CommandResult;

}
interface CommandParseResult {
	caller: Player;
	isCommandFound: boolean;
	command: Command | null;
	args: string[];
}
export type CommandResult =
	| { ok: true; message?: string; output?: any }
	| { ok: false; error: string; needsHelp?: boolean };

// export interface CommandExecResult {
// 	error: string | null;
// 	caller: Player;
// 	command: Command | null;
// 	args: string[];
// 	output?: any;
// 	needsHelp: boolean;
// }

export class CommandManager {
	//public commands: Command[];
	public commands: Record<string, Command>;
	public commandAliases: Record<string, string>;
	constructor() {
		this.commands = {};
		this.commandAliases = {};
	}

	//     export function registerCommand(name: string, descriptions: string[], execute: (player: Player, args: string[]) => void) {
	// 	commands.push	({ name, descriptions, execute });
	// }
	registerAlias(alias: string, name: string) {
		this.commandAliases[alias] = name;
	}
	unregisterAlias(alias: string) {
		delete this.commandAliases[alias];
	}
	registerCommand(name: string, helpStrings: string[], minArguments: number, cooldownSeconds: number, needsAdmin: boolean, needsSuperAdmin: boolean, execute: (player: Player, args: string[]) => CommandResult) {
		this.commands[name] = { name, helpStrings, minArguments, cooldownSeconds, needsAdmin, needsSuperAdmin, execute };
	}
	unregisterCommand(name: string) {
		delete this.commands[name];
	}
	parseCommandInputs(player: Player, message: string) {
		const parseResult: CommandParseResult = {
			caller: player,
			isCommandFound: false,
			command: null,
			args: []
		}
		const [cmd, ...args] = message.split(" ");
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
	executeCommand(commandData: CommandParseResult): CommandResult {
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
			return command.execute(caller, args);
		} catch (commandException) {
			util.debugLog(`executeCommand: command failed for player ${caller.name} #${caller.id}`);
			util.debugLog(commandException);
			return { ok: false, error: "Command exception" };
		}
	}
	parseAndExecuteCommand(player: Player, message: string): void {
		const parseResult = this.parseCommandInputs(player, message);
		if (!parseResult.isCommandFound) {
			util.errorPM(player, "Command not found");
			return;
		}
		if (parseResult.command && parseResult.args.length < parseResult.command.minArguments) {
			util.errorPM(player, `Too few arguments. Use .help ${parseResult.command.name}`);
			return;
		}
		const result = this.executeCommand(parseResult);
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
commandManager.registerCommand("help", ["Get help"], 0, 5, false, false, (player, args) => {
	const commandList = Object.values(commandManager.commands)
		.map(c => `.${c.name}`)        // simple formatting
		.join(" ");
	util.pm(player, `Commands: ${commandList}`);
	return { ok: true, message: "Help sent" };
});
commandManager.registerCommand("admin", [".admin [password]: Get admin privileges"], 1, 5, false, false, (player, args) => {
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
});
commandManager.registerCommand("promote",
	[".promote [player] admin / superadmin / dev: promote a player to admin"],
	2, 3, true, false, (player, args) => {
		const [playerQuery, rank] = args;
		const targetPlayer = playerManager.getByQuery(playerQuery);
		if (!targetPlayer) {
			return { ok: false, error: "Player not found" };
		}
		if (rank === "admin" && player.isAdmin) {
			if (targetPlayer.isAdmin) {
				return { ok: false, error: "Player is already admin" };
			}
			playerManager.setAdmin(targetPlayer, true);
			return { ok: true, message: `You promoted ${targetPlayer.name} to admin` };
		}
		if (player.isSuperAdmin && rank === "superadmin") {
			if (targetPlayer.isSuperAdmin) {
				return { ok: false, error: "Player is already super admin" };
			}
			playerManager.setSuperAdmin(targetPlayer, true);
			return { ok: true, message: `You promoted ${targetPlayer.name} to super admin` };
		}
		if (player.isSuperAdmin && rank === "dev") {
			if (targetPlayer.isDeveloper) {
				return { ok: false, error: "Player is already developer" };
			}
			playerManager.setDeveloper(targetPlayer, true);
			return { ok: true, message: `You promoted ${targetPlayer.name} to developer` };
		}
		return { ok: false, error: "Invalid rank" };
	});

commandManager.registerCommand("demote",
	[".demote [player]: demote a player"],
	1, 3, true, false, (player, args) => {
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
			return { ok: false, error: "You are not allowed to demote this player" };
		}
		playerManager.setAdmin(targetPlayer, false);
		return { ok: true, message: `You demoted ${targetPlayer.name}` };
	});
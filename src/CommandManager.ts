import type { Player } from "./types";
import { gameManager } from "./GameManager";
import * as util from "./util";

export interface Command {
	name: string;
	descriptions: string[];
	execute: (player: Player, args: string[]) => [result: any, error: string | null];
}
interface CommandParseResult {
	caller: Player;
	isCommandFound: boolean;
	command: Command | null;
	args: string[];
}

export interface CommandExecResult {
	error: string | null;
	caller: Player;
	command: Command | null;
	args: string[];
	result?: any;
}

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
	registerCommand(name: string, descriptions: string[], execute: (player: Player, args: string[]) => [result: any, error: string | null]) {
		this.commands[name] = { name, descriptions, execute };
	}
	unregisterCommand(name: string) {
		delete this.commands[name];
	}
	parseCommand(player: Player, message: string) {
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
	executeCommand(commandData: CommandParseResult): CommandExecResult {
		util.debugLog(`${commandData.caller.name}: ${commandData.command?.name} ${commandData.args.join(" ")}`);
		const executionResult: CommandExecResult = {
			error: null,
			caller: commandData.caller,
			command: commandData.command,
			args: commandData.args,
			result: null
		};
		try {
			//const [result, error] = commandData.command?.execute(commandData.caller, commandData.args);
			const [result, error] = commandData.command?.execute(commandData.caller, commandData.args) ?? [null, "Command not found"];
			executionResult.result = result;
			executionResult.error = error;
		} catch (error) {
			util.debugLog(`executeCommand: command failed for player ${commandData.caller.name} #${commandData.caller.id}`);
			util.debugLog(error);
		}
		return executionResult;
	}

}
export const commandManager = new CommandManager();
commandManager.registerCommand("admin", ["Get admin privileges"], (player: Player, args: string[]) => { return [null, null]; })
commandManager.registerCommand("testerror", [""], (player: Player, args: string[]) => {
	throw new Error("Test error");
	return [null, null];
})
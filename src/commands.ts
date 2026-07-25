import { Player } from "./types";
import { gameManager } from "./GameManager";

export interface Command {
	name: string;
	descriptions: string[];
	execute: (player: Player, args: string[]) => void;
}

export const commands: Command[] = [
	{
		name: "admin",
		descriptions: ["Grant admin privileges to a player"],
		execute: (player: Player, args: string[]) => {
			// Implementation for admin command
		}
	}
];

//registerCommand("admin", ["Grant admin privileges to a player"], (player: Player, args: string[]) => {
//	// Implementation for admin command
//}
gameManager.registerCommand("admin", ["Grant admin privileges to a player"], (player: Player, args: string[]) => {})
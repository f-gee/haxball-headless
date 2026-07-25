import { Player } from "./types";

class PlayerManager {
    // Main lookup table
    public all = new Map<number, Player>();

    // High-performance index subsets (Sets preserve instant add/delete)
    public redTeam = new Set<Player>();
    public blueTeam = new Set<Player>();
    public admins = new Set<Player>();
    public superAdmins = new Set<Player>();
    public developers = new Set<Player>();

    public addPlayer(player: Player) {
        this.all.set(player.id, player);

        // Categorize immediately on join
        if (player.team === 1) this.redTeam.add(player);
        if (player.team === 2) this.blueTeam.add(player);
        if (player.isAdmin) this.admins.add(player);
    }

    public removePlayer(playerId: number) {
        const player = this.all.get(playerId);
        if (!player) return;

        // Clean up all subsets instantly (O(1))
        this.redTeam.delete(player);
        this.blueTeam.delete(player);
        this.admins.delete(player);

        this.all.delete(playerId);
    }

    public handleTeamChange(playerId: number, newTeam: number) {
        const player = this.all.get(playerId);
        if (!player) return;

        // Remove from old team tracking
        if (player.team === 1) this.redTeam.delete(player);
        if (player.team === 2) this.blueTeam.delete(player);

        // Update property and add to new tracking
        player.team = newTeam;
        if (newTeam === 1) this.redTeam.add(player);
        if (newTeam === 2) this.blueTeam.add(player);
    }
}

export const playerManager = new PlayerManager();

// Add some players
// manager.addPlayer({
//   id: 1,
//   name: "Alice",
//   team: 1, // red
//   isAdmin: true,
//   elo: 1500,
//   lastActivity: new Date()
// });
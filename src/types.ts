export interface Player {
    team: number;
    isAfk: boolean;
    isAdmin: boolean;
    isSuperAdmin: boolean;
    isDeveloper: boolean;
    id: number;
    name: string;
    elo: number;
    lastActivity: Date;
}
export interface VanillaPlayer {
    id: number;
    name: string;
    team: number;
    admin: boolean;
    conn: string;
    auth: string;
}
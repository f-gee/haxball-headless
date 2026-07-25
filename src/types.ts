export interface Player {
    team: number;
    isAdmin: boolean;
    isSuperAdmin: boolean;
    id: number;
    name: string;
    elo: number;
    lastActivity: Date;
}
export interface HaxballPlayer {
    id: number;
    name: string;
    team: number;
    admin: boolean;
    conn: string;
    auth: string;
}
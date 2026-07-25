declare function HBInit(config: {
    roomName?: string;
    maxPlayers?: number;
    public?: boolean;
    noPlayer?: boolean;
    token?: string;
    [key: string]: any;
}): any;
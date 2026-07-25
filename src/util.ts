export function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

export function shuffleArray<T>(arr: T[]): T[] {
    return [...arr].sort(() => Math.random() - 0.5);
}

export function debugLog(message?: any) {
    if (message != null) {
        console.log(`debugLog: ${message}`);
    } else {
        console.log("debugLog: message is null");
    }
}
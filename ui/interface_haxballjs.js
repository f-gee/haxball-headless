const fs = require('fs');
const path = require('path');
const HaxballJS = require('haxball.js').default;

const delay = ms => new Promise(res => setTimeout(res, ms));

let hjsContext;

function createRoom(token) {
    return new Promise((resolve, reject) => {
        const bundlePath = path.join(__dirname, '..', 'dist', 'bundle.node_dev.js');
        delete require.cache[require.resolve(bundlePath)]; // trying to fix empty botExports
        HaxballJS().then((HBInit) => {
            try {
                require(bundlePath)(HBInit, token, (botExports) => {
                    hjsContext = botExports;
                    //console.log("ctx:");
                    //console.log(hjsContext);
                    // console.log("keys:", Object.keys(botExports));
                    // console.log("room:", botExports.room);
                    // console.log("util:", typeof botExports.util, botExports.util);
                    resolve(botExports);
                });
            } catch (err) {
                console.log("haxball.js createRoom error: " + err);
                reject(err);
            }
        }).catch(reject); // in case HaxballJS() itself rejects
    });
}

async function closeRoom() {
    hjsContext.room.sendAnnouncement('🤖 ROOM IS CLOSING! 🤖');
    await delay(5000);
    process.exit();
    return { ok: true, message: "room closed" };
}

// async function closeRoom() {
//     if (!hjsContext || !hjsContext.room) {
//         throw new Error("No room to close");
//     }
//     console.log("Sending close announcement...");
//     const result = hjsContext.room.sendAnnouncement('🤖 ROOM IS CLOSING! 🤖');
//     console.log("sendAnnouncement returned:", result);
//     await delay(5000);
//     console.log("Delay finished, exiting now.");
//     process.exit();
//     return { ok: true, message: "room closed" };
// }

function fEval(scr, ctx) { return (new Function("with(this) { return " + scr + "}")).call(ctx); }

async function safeEvaluate(code) {
    try {
        let result = fEval(code, hjsContext);
        if (result instanceof Promise) {
            result = await result;
        }
        return { ok: true, result };
    } catch (err) {
        return { ok: false, error: err.message };
    }
}

module.exports = {
    createRoom,
    closeRoom,
    safeEvaluate,
    //ctx,
};
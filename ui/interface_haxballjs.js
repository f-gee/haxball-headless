const fs = require('fs');
const path = require('path');
const HaxballJS = require('haxball.js').default;

const delay = ms => new Promise(res => setTimeout(res, ms));

let hjsContext;

function createRoom(token) {
    return new Promise((resolve, reject) => {
        const bundlePath = path.join(__dirname, '..', 'dist', 'bundle.node_prod.js');
        delete require.cache[require.resolve(bundlePath)]; // trying to fix empty botExports
        HaxballJS().then((HBInit) => {
            try {
                require(bundlePath)(HBInit, token, (botExports) => {
                    hjsContext = botExports;
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

function fEval(scr, ctx) { return (new Function("with(this) { return " + scr + "}")).call(ctx); }

async function safeEvaluate(code) {
    try {
        let value = fEval(code, hjsContext);
        if (value instanceof Promise) {
            value = await value;
        }
        return { ok: true, value };
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
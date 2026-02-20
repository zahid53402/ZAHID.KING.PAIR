const express = require('express');
const path = require('path');
const pino = require('pino');
const fs = require('fs-extra');
const { default: makeWASocket, useMultiFileAuthState, delay, Browsers } = require("@whiskeysockets/baileys");

const app = express();
const PORT = process.env.PORT || 8080;

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'pair.html'));
});

async function generatePairCode(req, res) {
    let num = req.query.number;
    if (!num) return res.status(400).json({ error: "Number missing" });

    const sessionDir = './session_' + Math.random().toString(36).substring(7);
    const { state, saveCreds } = await useMultiFileAuthState(sessionDir);

    try {
        const sock = makeWASocket({
            auth: state,
            printQRInTerminal: false,
            logger: pino({ level: 'silent' }),
            browser: Browsers.macOS("Chrome")
        });

        if (!sock.authState.creds.registered) {
            await delay(3000);
            const code = await sock.requestPairingCode(num);
            if (!res.headersSent) res.json({ code: code });
        }

        sock.ev.on('creds.update', saveCreds);
        sock.ev.on('connection.update', async (s) => {
            if (s.connection === 'open') {
                await delay(5000);
                const authFile = fs.readFileSync(sessionDir + '/creds.json');
                const sessionId = Buffer.from(authFile).toString('base64');
                await sock.sendMessage(sock.user.id, { text: `ZAHID-KING;;;${sessionId}` });
                setTimeout(() => { fs.rmSync(sessionDir, { recursive: true, force: true }); }, 10000);
            }
        });
    } catch (err) {
        if (!res.headersSent) res.status(500).json({ error: "Try Again" });
    }
}

app.get('/code', generatePairCode);

app.listen(PORT, () => {
    console.log(`Server is live on port ${PORT}`);
});

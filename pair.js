const express = require('express');
const path = require('path');
const pino = require('pino');
const fs = require('fs-extra');
const { 
    default: makeWASocket, 
    useMultiFileAuthState, 
    delay, 
    makeCacheableSignalKeyStore,
    DisconnectReason
} = require("@whiskeysockets/baileys");

const app = express();
const PORT = process.env.PORT || 80; 

// مین پیج
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'pair.html'));
});

async function ZAHID_KING_PAIR_CODE(req, res) {
    let num = req.query.number;
    if (!num) return res.status(400).json({ error: "Number missing" });

    // سیشن ڈائریکٹری
    const sessionDir = path.join(__dirname, 'session_' + Math.random().toString(36).substring(7));
    if (!fs.existsSync(sessionDir)) fs.mkdirSync(sessionDir);

    const { state, saveCreds } = await useMultiFileAuthState(sessionDir);

    try {
        const sock = makeWASocket({
            auth: {
                creds: state.creds,
                keys: makeCacheableSignalKeyStore(state.keys, pino({ level: 'silent' })),
            },
            printQRInTerminal: false,
            logger: pino({ level: 'silent' }),
            // نوٹیفیکیشن نہ آنے کا حل: براؤزر کو Chrome Windows پر سیٹ کر دیا
            browser: ["Chrome (Windows)", "Chrome", "110.0.5481.178"]
        });

        // پیئرنگ کوڈ کی ریکویسٹ
        if (!sock.authState.creds.registered) {
            await delay(3000);
            // نمبر سے پہلے پلس (+) ختم کرنے کے لیے
            let phoneNumber = num.replace(/[^0-9]/g, '');
            const code = await sock.requestPairingCode(phoneNumber);
            if (!res.headersSent) {
                res.json({ code: code });
            }
        }

        sock.ev.on('creds.update', saveCreds);

        sock.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect } = update;

            if (connection === 'open') {
                await delay(10000);
                const credsPath = path.join(sessionDir, 'creds.json');
                
                if (fs.existsSync(credsPath)) {
                    const authFile = fs.readFileSync(credsPath);
                    const sessionId = Buffer.from(authFile).toString('base64');
                    const finalId = `ZAHID-KING;;;${sessionId}`;

                    // سیشن آئی ڈی بھیجنا
                    await sock.sendMessage(sock.user.id, { 
                        text: `*✅ Zᴀʜɪᴅ Kɪɴɢ CᴏɴɴᴇᴄᴛED*\n\n*SESSION ID:*\n\n${finalId}\n\n> Don't share this ID with anyone!` 
                    });

                    console.log("✅ Session ID Sent!");
                }

                // سیشن فولڈر کی صفائی
                setTimeout(() => { 
                    try { fs.rmSync(sessionDir, { recursive: true, force: true }); } catch (e) {}
                }, 15000);
            }

            // اگر کنکشن کٹ جائے تو دوبارہ کنیکٹ نہ کرے تاکہ سیشن کلین رہے
            if (connection === 'close') {
                let reason = lastDisconnect?.error?.output?.statusCode;
                if (reason === DisconnectReason.restartRequired) {
                    console.log("Restart Required...");
                }
            }
        });

    } catch (err) {
        console.error("Error:", err);
        if (!res.headersSent) res.status(500).json({ error: "Server Error" });
    }
}

app.get('/code', ZAHID_KING_PAIR_CODE);

app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 ZAHID KING Server is Live on Port ${PORT}`);
});

const express = require('express');
const path = require('path');
const pino = require('pino');
const fs = require('fs-extra');
const { 
    default: makeWASocket, 
    useMultiFileAuthState, 
    delay, 
    Browsers, 
    makeCacheableSignalKeyStore 
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

    // سیشن کے لیے الگ فولڈر
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
            // واٹس ایپ نوٹیفیکیشن کے لیے یہ سیٹنگ بہترین ہے
            browser: ["Ubuntu", "Chrome", "20.0.04"]
        });

        // کوڈ جنریٹ کرنا
        if (!sock.authState.creds.registered) {
            await delay(3000);
            const code = await sock.requestPairingCode(num);
            if (!res.headersSent) {
                res.json({ code: code });
            }
        }

        sock.ev.on('creds.update', saveCreds);

        sock.ev.on('connection.update', async (s) => {
            const { connection, lastDisconnect } = s;

            if (connection === 'open') {
                await delay(10000);
                
                const credsPath = path.join(sessionDir, 'creds.json');
                if (fs.existsSync(credsPath)) {
                    const authFile = fs.readFileSync(credsPath);
                    const sessionId = Buffer.from(authFile).toString('base64');
                    
                    // فائنل آئی ڈی فارمیٹ
                    const finalId = `ZAHID-KING;;;${sessionId}`;

                    // سیشن آئی ڈی واٹس ایپ پر بھیجنا
                    await sock.sendMessage(sock.user.id, { 
                        text: `*✅ Zᴀʜɪᴅ Kɪɴɢ Cᴏɴɴᴇᴄᴛᴇᴅ*\n\n*SESSION ID:* \n\n${finalId}\n\n> Don't share your session ID with anyone!` 
                    });

                    console.log("✅ Session ID sent to WhatsApp!");
                }

                // صفائی (Cleanup)
                setTimeout(() => { 
                    try { fs.rmSync(sessionDir, { recursive: true, force: true }); } catch (e) {}
                }, 15000);
            }

            if (connection === 'close') {
                // اگر کنکشن بند ہو جائے تو یہاں سے ہینڈل کیا جا سکتا ہے
            }
        });

    } catch (err) {
        console.error("Error in Pairing:", err);
        if (!res.headersSent) res.status(500).json({ error: "Internal Server Error" });
    }
}

app.get('/code', ZAHID_KING_PAIR_CODE);

app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 ZAHID KING Server is Live on Port ${PORT}`);
});

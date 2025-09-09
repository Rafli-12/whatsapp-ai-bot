const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys')
const qrcode = require('qrcode-terminal')
const axios = require('axios')

// Ganti dengan API Key kamu
const API_KEY = process.env.SUMOPOD_KEY || "ISI_API_KEY_KAMU_DI_SINI"

async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState('./auth')
    const sock = makeWASocket({ auth: state })

    // Tampilkan QR Code di terminal saat pertama kali login
    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect, qr } = update
        if (qr) qrcode.generate(qr, { small: true })

        if (connection === 'close') {
            const shouldReconnect =
                lastDisconnect.error?.output?.statusCode !== DisconnectReason.loggedOut
            if (shouldReconnect) startBot()
        } else if (connection === 'open') {
            console.log('✅ Bot sudah terhubung ke WhatsApp!')
        }
    })

    sock.ev.on('messages.upsert', async (msg) => {
        const m = msg.messages[0]
        if (!m.message || m.key.fromMe) return

        const from = m.key.remoteJid
        const text = m.message.conversation || m.message.extendedTextMessage?.text

        if (text) {
            console.log(`📩 Pesan dari ${from}: ${text}`)

            try {
                // Panggil AI dari Sumopod
                const res = await axios.post(
                    "https://api.sumopod.com/v1/chat/completions",
                    {
                        model: "gpt-3.5-turbo",
                        messages: [{ role: "user", content: text }]
                    },
                    {
                        headers: {
                            "Content-Type": "application/json",
                            "Authorization": `Bearer ${API_KEY}`
                        }
                    }
                )

                const reply = res.data.choices[0].message.content
                await sock.sendMessage(from, { text: reply })
            } catch (err) {
                console.error(err)
                await sock.sendMessage(from, { text: "⚠️ Error memproses pesan" })
            }
        }
    })

    sock.ev.on('creds.update', saveCreds)
}

startBot()

import makeWASocket, {
  useMultiFileAuthState,
  DisconnectReason
} from '@whiskeysockets/baileys'
import qrcode from 'qrcode-terminal'
import OpenAI from 'openai'
import Pino from 'pino'
import express from 'express'

const app = express()
app.get("/", (req, res) => res.send("Raios WhatsApp Bot is running"))
app.listen(process.env.PORT || 3000)

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
})

async function startBot() {
  const { state, saveCreds } = await useMultiFileAuthState('auth')

  const sock = makeWASocket({
    auth: state,
    logger: Pino({ level: 'silent' })
  })

  sock.ev.on('creds.update', saveCreds)

  sock.ev.on('connection.update', (update) => {
    const { connection, qr } = update

    if (qr) {
      console.log("📲 ESCANEA ESTE QR CON WHATSAPP")
      qrcode.generate(qr, { small: true })
    }

    if (connection === 'open') {
      console.log("✅ WHATSAPP CONECTADO A RAIOS BOT")
    }

    if (connection === 'close') {
      console.log("❌ WhatsApp desconectado")
      startBot()
    }
  })

  sock.ev.on('messages.upsert', async ({ messages }) => {
    const msg = messages[0]
    if (!msg.message || msg.key.fromMe) return

    const texto =
      msg.message.conversation ||
      msg.message.extendedTextMessage?.text

    if (!texto) return

    console.log("📩 Mensaje recibido:", texto)

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "Eres el asistente de la marca Raios, una marca de ropa deportiva. Responde como vendedor profesional."
        },
        { role: "user", content: texto }
      ]
    })

    const respuesta = completion.choices[0].message.content

    await sock.sendMessage(msg.key.remoteJid, { text: respuesta })
  })
}

startBot()

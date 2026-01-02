import makeWASocket, { useMultiFileAuthState } from '@whiskeysockets/baileys'
import OpenAI from 'openai'
import Pino from 'pino'
import express from 'express'
import QRCode from 'qrcode'

const app = express()
let lastQR = null

app.get("/", (req, res) => {
  if (!lastQR) {
    res.send("⏳ Esperando QR de WhatsApp...")
  } else {
    res.send(`
      <h2>Escanea este QR con WhatsApp</h2>
      <img src="${lastQR}" />
    `)
  }
})

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

  sock.ev.on('connection.update', async (update) => {
    const { connection, qr } = update

    if (qr) {
      lastQR = await QRCode.toDataURL(qr)
      console.log("QR listo")
    }

    if (connection === "open") {
      console.log("✅ WhatsApp conectado")
    }
  })

  sock.ev.on('messages.upsert', async ({ messages }) => {
    const msg = messages[0]
    if (!msg.message || msg.key.fromMe) return

    const texto =
      msg.message.conversation ||
      msg.message.extendedTextMessage?.text

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "Eres el asistente de la marca Raios, una marca de ropa deportiva."
        },
        { role: "user", content: texto }
      ]
    })

    await sock.sendMessage(msg.key.remoteJid, {
      text: completion.choices[0].message.content
    })
  })
}

startBot()


startBot()

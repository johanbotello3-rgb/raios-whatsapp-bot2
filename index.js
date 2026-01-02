import makeWASocket, {
  useMultiFileAuthState,
  fetchLatestBaileysVersion
} from '@whiskeysockets/baileys'
import OpenAI from 'openai'
import Pino from 'pino'
import express from 'express'

const app = express()
let pairingCode = "Esperando código..."

app.get("/", (req, res) => {
  res.send(`
    <h2>Raios WhatsApp Bot</h2>
    <p>En tu WhatsApp ve a:</p>
    <b>Dispositivos vinculados → Vincular → Ingresar código</b>
    <h1>${pairingCode}</h1>
  `)
})

app.listen(process.env.PORT || 3000)

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
})

async function startBot() {
  const { state, saveCreds } = await useMultiFileAuthState("auth")
  const { version } = await fetchLatestBaileysVersion()

  const sock = makeWASocket({
    auth: state,
    version,
    printQRInTerminal: false,
    logger: Pino({ level: "silent" })
  })

  sock.ev.on("creds.update", saveCreds)

  if (!state.creds.registered) {
    const code = await sock.requestPairingCode("573214148007") // CAMBIA POR TU NUMERO
    pairingCode = code
    console.log("Código de vinculación:", code)
  }

  sock.ev.on("connection.update", (update) => {
    if (update.connection === "open") {
      console.log("✅ WhatsApp conectado")
      pairingCode = "✅ WhatsApp conectado"
    }
  })

  sock.ev.on("messages.upsert", async ({ messages }) => {
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
          content: "Eres el asistente de la marca Raios, ropa deportiva."
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

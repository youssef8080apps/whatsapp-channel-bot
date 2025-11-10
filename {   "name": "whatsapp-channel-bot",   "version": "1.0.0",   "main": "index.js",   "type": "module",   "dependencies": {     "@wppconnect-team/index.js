import express from "express";
import wppconnect from "@wppconnect-team/wppconnect";
import fs from "fs";

let client;

const SESSION_FOLDER = "/app/session";

if (!fs.existsSync(SESSION_FOLDER)) fs.mkdirSync(SESSION_FOLDER, { recursive: true });

const app = express();
app.use(express.json());

// ✅ Start WhatsApp bot
wppconnect
  .create({
    session: "bot-session",
    headless: true,
    catchQR: (qr) => {
      fs.writeFileSync("/app/session/qr.txt", qr);
      console.log("✅ QR generated");
    },
    folderNameToken: SESSION_FOLDER,
    disableWelcome: true
  })
  .then((cli) => {
    client = cli;
    console.log("✅ WhatsApp connected!");
  })
  .catch((err) => console.log("❌ ERROR:", err));

// ✅ Endpoint: Get QR
app.get("/qr", (req, res) => {
  if (!fs.existsSync("/app/session/qr.txt"))
    return res.status(404).json({ error: "QR not generated yet" });

  const qr = fs.readFileSync("/app/session/qr.txt", "utf8");
  res.send(`<img src="https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${qr}">`);
});

// ✅ Endpoint: Send message to channel
app.post("/send", async (req, res) => {
  const { text, channel } = req.body;

  try {
    await client.sendText(channel, text);
    res.json({ sent: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.listen(3000, () => console.log("✅ API Active on :3000"));

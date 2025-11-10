import express from "express";
import puppeteer from "puppeteer";
import fs from "fs";
import path from "path";

const CHANNEL_URL = "https://web.whatsapp.com/channel/0029Vb1thBVEQIavlDI5Tw0a";

// ✅ استخدم نفس المكان اللي في Dockerfile
const DATA_DIR = process.env.DATA_DIR || "/app/data";
const SESSION_FILE = path.join(DATA_DIR, "session.json");
const QR_FILE = path.join(DATA_DIR, "qr.png");

let browser;
let page;

async function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

async function startBrowser() {
  await ensureDataDir();

  console.log("🚀 Starting Chrome...");

  browser = await puppeteer.launch({
    headless: false,
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-gpu",
      "--window-size=1280,800"
    ]
  });

  page = await browser.newPage();

  // ✅ Load session (if exists)
  if (fs.existsSync(SESSION_FILE)) {
    const cookies = JSON.parse(fs.readFileSync(SESSION_FILE, "utf-8"));
    if (Array.isArray(cookies) && cookies.length) {
      await page.setCookie(...cookies);
      console.log("✅ Session loaded");
    }
  }

  console.log("🔗 Opening WhatsApp Web...");

  await page.goto("https://web.whatsapp.com", { waitUntil: "networkidle2" });

  // ✅ Capture QR
  try {
    await page.waitForSelector("canvas", { timeout: 15000 });
    const canvas = await page.$("canvas");
    if (canvas) {
      await canvas.screenshot({ path: QR_FILE });
      console.log("✅ QR captured to /app/data/qr.png");
    }
  } catch (_) {
    console.log("✅ No QR needed, maybe already logged in.");
  }

  // ✅ Wait for WA ready
  try {
    await page.waitForSelector("[data-testid='chat-list-search']", { timeout: 60000 });
    console.log("✅ WhatsApp Connected!");
  } catch {
    console.log("⚠️ WhatsApp not fully ready.");
  }

  // ✅ Save cookies
  const cookies = await page.cookies();
  fs.writeFileSync(SESSION_FILE, JSON.stringify(cookies, null, 2));
  console.log("✅ Session saved");
}

async function sendToChannel(message) {
  if (!page) throw new Error("Browser not started");

  await page.goto(CHANNEL_URL, { waitUntil: "networkidle2" });

  const editorSel = "[contenteditable='true'][data-tab='10'], [contenteditable='true']";
  await page.waitForSelector(editorSel, { timeout: 20000 });

  await page.type(editorSel, message);
  await page.keyboard.press("Enter");

  console.log("✅ Message sent");
  return true;
}

const app = express();
app.use(express.json());

app.get("/qr", (req, res) => {
  if (fs.existsSync(QR_FILE)) {
    res.setHeader("Content-Type", "image/png");
    fs.createReadStream(QR_FILE).pipe(res);
  } else {
    res.status(404).json({ error: "QR not generated yet" });
  }
});

app.get("/session", (req, res) => {
  res.json({ loggedIn: fs.existsSync(SESSION_FILE) });
});

app.post("/send", async (req, res) => {
  try {
    const { text } = req.body;
    if (!text) return res.status(400).json({ error: "text is required" });

    const ok = await sendToChannel(text);
    return res.json({ status: "sent" });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: e.message });
  }
});

app.listen(3000, () => console.log("✅ API running on :3000"));

startBrowser().catch(err => {
  console.error("❌ Browser start error:", err);
  process.exit(1);
});

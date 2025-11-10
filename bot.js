import express from "express";
import puppeteer from "puppeteer-core";
import fs from "fs";
import path from "path";

const CHANNEL_URL = "https://web.whatsapp.com/channel/0029Vb1thBVEQIavlDI5Tw0a";

const DATA_DIR = "/data";
const SESSION_FILE = path.join(DATA_DIR, "session.json");
const QR_FILE = path.join(DATA_DIR, "qr.png");

// ✅ Chrome path on server
const CHROME_PATH = "/usr/bin/google-chrome-stable";

let browser;
let page;

async function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

async function startBrowser() {
  await ensureDataDir();

  console.log("🚀 Starting Chrome...");

  browser = await puppeteer.launch({
    headless: true,
    executablePath: CHROME_PATH,
    args: [
      "--no-sandbox",
      "--disable-gpu",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-accelerated-2d-canvas",
      "--disable-software-rasterizer",
      "--no-first-run",
      "--no-zygote",
      "--single-process",
      "--window-size=1920,1080"
    ]
  });

  page = await browser.newPage();

  // ✅ Load saved session
  if (fs.existsSync(SESSION_FILE)) {
    const cookies = JSON.parse(fs.readFileSync(SESSION_FILE, "utf-8"));
    if (Array.isArray(cookies) && cookies.length) {
      await page.setCookie(...cookies);
      console.log("✅ Session loaded");
    }
  }

  console.log("🔗 Opening WhatsApp Web...");

  await page.goto("https://web.whatsapp.com", { waitUntil: "networkidle2" });

  // ✅ Capture QR if needed
  try {
    await page.waitForSelector("canvas", { timeout: 15000 });
    const canvas = await page.$("canvas");
    if (canvas) {
      await canvas.screenshot({ path: QR_FILE });
      console.log("✅ QR captured to /data/qr.png");
    }
  } catch (_) {
    console.log("✅ No QR needed, probably already logged in.");
  }

  // ✅ Wait for WhatsApp to be ready
  try {
    await page.waitForSelector("[data-testid='chat-list-search']", { timeout: 60000 });
    console.log("✅ WhatsApp Connected!");
  } catch {
    console.log("⚠️ WhatsApp not fully ready yet.");
  }

  // ✅ Save session
  const cookies = await page.cookies();
  fs.writeFileSync(SESSION_FILE, JSON.stringify(cookies, null, 2));
  console.log("✅ Session saved");
}

async function sendToChannel(message) {
  if (!page) throw new Error("Browser not started");

  console.log("📨 Navigating to channel...");
  await page.goto(CHANNEL_URL, { waitUntil: "networkidle2" });

  // ✅ Find writing input (WhatsApp changes this a lot)
  const editorSel = "[contenteditable='true'][data-tab='10'], [contenteditable='true']";

  await page.waitForSelector(editorSel, { timeout: 20000 });

  await page.type(editorSel, message);
  await page.keyboard.press("Enter");

  console.log("✅ Message sent to channel");

  return true;
}

const app = express();
app.use(express.json());

// ✅ Return QR file
app.get("/qr", (req, res) => {
  if (fs.existsSync(QR_FILE)) {
    res.setHeader("Content-Type", "image/png");
    fs.createReadStream(QR_FILE).pipe(res);
  } else {
    res.status(404).json({ error: "QR not generated yet" });
  }
});

// ✅ Session status
app.get("/session", (req, res) => {
  res.json({ loggedIn: fs.existsSync(SESSION_FILE) });
});

// ✅ Send message to WhatsApp Channel
app.post("/send", async (req, res) => {
  try {
    const { text } = req.body;
    if (!text) return res.status(400).json({ error: "text is required" });

    const ok = await sendToChannel(text);
    if (ok) return res.json({ status: "sent" });
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

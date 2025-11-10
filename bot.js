import express from "express";
import puppeteer from "puppeteer";
import fs from "fs";
import path from "path";

const CHANNEL_URL = "https://web.whatsapp.com/channel/0029Vb1thBVEQIavlDI5Tw0a";

const DATA_DIR = "/app/data";
const SESSION_FILE = path.join(DATA_DIR, "session.json");
const QR_FILE = path.join(DATA_DIR, "qr.png");

let browser;
let page;

async function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

async function startBrowser() {
  await ensureDataDir();

  console.log("🚀 Launching Chrome (Headless)…");

browser = await puppeteer.launch({
  executablePath: process.env.PUPPETEER_EXECUTABLE_PATH,
  headless: true,
  args: [
    "--no-sandbox",
    "--disable-setuid-sandbox",
    "--disable-dev-shm-usage",
    "--disable-gpu",
    "--disable-software-rasterizer",
    "--window-size=1280,800",
    "--disable-features=IsolateOrigins,site-per-process",
    "--disable-features=UserAgentClientHint",
    "--disable-web-security",
    "--disable-extensions",
    "--no-first-run",
    "--no-zygote",
    "--ignore-certificate-errors",
    "--allow-running-insecure-content",
    "--disable-background-networking",
    "--disable-default-apps",
    "--disable-sync",
    "--disable-domain-reliability",
    "--disable-breakpad",
    "--disable-ipc-flooding-protection",
    "--disable-renderer-backgrounding",
    "--force-color-profile=srgb",
    "--use-gl=swiftshader",
    "--enable-features=NetworkService,NetworkServiceInProcess"
  ]
});



  page = await browser.newPage();

  // ✅ Load previous session
  if (fs.existsSync(SESSION_FILE)) {
    const cookies = JSON.parse(fs.readFileSync(SESSION_FILE, "utf-8"));
    await page.setCookie(...cookies);
    console.log("✅ Session loaded");
  }

  console.log("🔗 Opening WhatsApp Web…");
  await page.goto("https://web.whatsapp.com", { waitUntil: "networkidle2" });

  // ✅ Capture QR
  try {
    await page.waitForSelector("canvas", { timeout: 20000 });
    const canvas = await page.$("canvas");
    await canvas.screenshot({ path: QR_FILE });
    console.log("✅ QR saved");
  } catch {
    console.log("✅ Already logged in");
  }

  // Wait for WhatsApp to be ready
  try {
    await page.waitForSelector("[data-testid='chat-list-search']", { timeout: 60000 });
    console.log("✅ WhatsApp Ready!");
  } catch {
    console.log("⚠️ WhatsApp not ready");
  }

  // Save session
  const cookies = await page.cookies();
  fs.writeFileSync(SESSION_FILE, JSON.stringify(cookies, null, 2));
  console.log("✅ Session saved");
}

async function sendToChannel(message) {
  await page.goto(CHANNEL_URL, { waitUntil: "networkidle2" });

  const selector = "[contenteditable='true']";
  await page.waitForSelector(selector);

  await page.type(selector, message);
  await page.keyboard.press("Enter");

  console.log("✅ Message sent");
}

const app = express();
app.use(express.json());

app.get("/qr", (req, res) => {
  if (!fs.existsSync(QR_FILE)) return res.status(404).json({ error: "Not ready" });
  res.setHeader("Content-Type", "image/png");
  fs.createReadStream(QR_FILE).pipe(res);
});

app.post("/send", async (req, res) => {
  try {
    await sendToChannel(req.body.text);
    res.json({ sent: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.listen(3000, () => console.log("✅ API Active on :3000"));

startBrowser().catch((err) => {
  console.error("❌ Chrome error:", err);
});

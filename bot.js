import express from "express";
import puppeteer from "puppeteer";
import fs from "fs";
import path from "path";

const CHANNEL_URL = "https://web.whatsapp.com/channel/0029Vb1thBVEQIavlDI5Tw0a";
const DATA_DIR = "./data";
const SESSION_FILE = path.join(DATA_DIR, "session.json");
const QR_FILE = path.join(DATA_DIR, "qr.png");

let browser;
let page;

async function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

async function startBrowser() {
  await ensureDataDir();

  browser = await puppeteer.launch({
    headless: true,                       // شغال على السيرفر
    args: ["--no-sandbox", "--disable-setuid-sandbox"]
  });
  page = await browser.newPage();

  // لو عندك كوكيز محفوظة من قبل
  if (fs.existsSync(SESSION_FILE)) {
    const cookies = JSON.parse(fs.readFileSync(SESSION_FILE, "utf-8"));
    if (Array.isArray(cookies) && cookies.length) {
      await page.setCookie(...cookies);
    }
  }

  await page.goto("https://web.whatsapp.com", { waitUntil: "networkidle2" });

  // لو مش لوج إن: هيبقى في QR
  try {
    // لو لسه محتاج QR، خد لقطة للشاشة للكانڤاس
    await page.waitForSelector("canvas", { timeout: 15000 });
    const canvas = await page.$("canvas");
    if (canvas) {
      await canvas.screenshot({ path: QR_FILE });
      console.log("✅ QR captured to /data/qr.png");
    }
  } catch (_) {
    // مفيش QR → غالبًا دخل
  }

  // استنى لحد ما يبقى فيه محرك البحث بتاع الشات → دليل إن login تم
  try {
    await page.waitForSelector("[data-testid='chat-list-search']", { timeout: 0 });
  } catch (e) {
    console.log("⚠️ لم يظهر شريط البحث، قد لا يكون تسجيل الدخول كاملاً بعد.");
  }

  // احفظ الجلسة
  const cookies = await page.cookies();
  fs.writeFileSync(SESSION_FILE, JSON.stringify(cookies, null, 2));
  console.log("✅ Session saved");
}

async function sendToChannel(message) {
  if (!page) throw new Error("Browser not started");
  await page.goto(CHANNEL_URL, { waitUntil: "networkidle2" });

  // صندوق الكتابة في القنوات (واتساب بيغيّر selectors أحيانًا)
  const editorSel = "[contenteditable='true']";
  await page.waitForSelector(editorSel, { timeout: 20000 });

  await page.type(editorSel, message);
  await page.keyboard.press("Enter");

  return true;
}

const app = express();
app.use(express.json());

// استرجاع QR كصورة
app.get("/qr", (req, res) => {
  if (fs.existsSync(QR_FILE)) {
    res.setHeader("Content-Type", "image/png");
    fs.createReadStream(QR_FILE).pipe(res);
  } else {
    res.status(404).json({ error: "QR not found yet. Open WhatsApp Web page first." });
  }
});

// حالة الجلسة
app.get("/session", (req, res) => {
  res.json({ loggedIn: fs.existsSync(SESSION_FILE) });
});

// نشر رسالة
app.post("/send", async (req, res) => {
  try {
    const { text } = req.body;
    if (!text) return res.status(400).json({ error: "text is required" });

    const ok = await sendToChannel(text);
    if (ok) return res.json({ status: "sent" });
    return res.status(500).json({ error: "failed" });
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

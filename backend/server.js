const path = require("path");
const http = require("http");
require("dotenv").config({ path: path.join(__dirname, ".env") });

const express = require("express");
const cors = require("cors");
const WebSocket = require("ws");
const analyzeRouter = require("./routes/analyze");
const helpRouter = require("./routes/help");
const callRouter = require("./routes/call");
const { attachCallStreamHub } = require("./ws/callStreamHub");

const app = express();
const PORT = Number(process.env.PORT) || 3001;

const RATE_WINDOW_MS = 60_000;
const RATE_MAX = Number(process.env.RATE_LIMIT_PER_MINUTE) || 120;
const rateBuckets = new Map();

function rateLimit(req, res, next) {
  const ip = req.ip || req.socket?.remoteAddress || "unknown";
  const now = Date.now();
  let bucket = rateBuckets.get(ip);
  if (!bucket || now - bucket.start > RATE_WINDOW_MS) {
    bucket = { start: now, count: 0 };
    rateBuckets.set(ip, bucket);
  }
  bucket.count += 1;
  if (bucket.count > RATE_MAX) {
    return res.status(429).json({
      error: "Too many requests. Please retry shortly.",
      code: "RATE_LIMIT",
    });
  }
  next();
}

setInterval(() => {
  const now = Date.now();
  for (const [ip, b] of rateBuckets) {
    if (now - b.start > RATE_WINDOW_MS * 2) rateBuckets.delete(ip);
  }
}, RATE_WINDOW_MS).unref?.();

/**
 * CORS_ORIGIN: omit or empty → allow any origin (reflect request origin).
 * Otherwise: comma-separated list, e.g. http://localhost:8080,http://127.0.0.1:8080
 */
function resolveCorsOrigin() {
  const raw = process.env.CORS_ORIGIN;
  if (raw === undefined || raw === null || String(raw).trim() === "") {
    return true;
  }
  const origins = String(raw)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (origins.length === 0) return true;
  if (origins.length === 1) return origins[0];
  return origins;
}

const corsOrigin = resolveCorsOrigin();
const corsCredentials =
  String(process.env.CORS_CREDENTIALS || "").toLowerCase() === "true";

app.disable("x-powered-by");
// So req.protocol / host match public URL when behind ngrok or a reverse proxy
app.set("trust proxy", 1);
app.use(
  cors({
    origin: corsOrigin,
    credentials: corsCredentials,
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);
app.use(express.json({ limit: "512kb" }));
app.use(express.urlencoded({ extended: true }));

// Request Logger for debugging 404s on Render
app.use((req, res, next) => {
  console.log(`[server] ${req.method} ${req.url}`);
  next();
});

app.get("/", (req, res) => {
  res.status(200).json({ 
    ok: true, 
    message: "Voice2Sense Backend is running",
    version: "1.0.1",
    endpoints: ["/analyze", "/help", "/call/dial", "/call/twiml"]
  });
});
app.use("/analyze", rateLimit, analyzeRouter);
app.use("/help", rateLimit, helpRouter);
app.use("/call", callRouter);

app.get("/health", (_req, res) => {
  res.status(200).json({ ok: true, service: "text-analyze" });
});

app.use((req, res) => {
  res.status(404).json({ error: "Not found", code: "NOT_FOUND" });
});

app.use((err, _req, res, _next) => {
  console.error("[server]", err);
  res.status(500).json({
    error:
      process.env.NODE_ENV === "development"
        ? err.message
        : "An unexpected error occurred",
    code: "INTERNAL_ERROR",
  });
});

const server = http.createServer(app);
const wss = new WebSocket.Server({ noServer: true });
attachCallStreamHub(wss);

server.on("upgrade", (request, socket, head) => {
  try {
    const host = request.headers.host || "localhost";
    const pathname = new URL(request.url || "/", `http://${host}`).pathname;
    if (pathname === "/api/call/stream") {
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit("connection", ws, request);
      });
    } else {
      socket.destroy();
    }
  } catch {
    socket.destroy();
  }
});

server.listen(PORT, () => {
  console.log(`Listening on http://localhost:${PORT}`);
  console.log(`WebSocket caller transcripts: ws://localhost:${PORT}/api/call/stream`);
  if (process.env.NODE_ENV === "development") {
    const label =
      corsOrigin === true
        ? "any origin"
        : Array.isArray(corsOrigin)
          ? corsOrigin.join(", ")
          : corsOrigin;
    console.log(`CORS allowed origins: ${label}`);
  }
});

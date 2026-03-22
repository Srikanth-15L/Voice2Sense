const WebSocket = require("ws");
const { logToFile } = require("../utils/logger");

/**
 * Twilio Media Streams + Deepgram live STT, fan-out transcripts to browser viewers.
 * Same URL (/api/call/stream): Twilio's first message is { event: "connected" };
 * browsers must send { role: "viewer" } immediately after open.
 */
function attachCallStreamHub(wss) {
  const viewers = new Set();

  function broadcastTranscript(text, isFinal = true) {
    const payload = JSON.stringify({ event: "transcript", text, isFinal });
    for (const ws of viewers) {
      if (ws.readyState === WebSocket.OPEN) {
        try {
          ws.send(payload);
        } catch (_) {}
      }
    }
  }

  wss.on("connection", (ws, req) => {
    const url = new URL(req.url || "/", "http://127.0.0.1");
    const lang = url.searchParams.get("lang");

    ws.once("message", async (raw) => {
      let msg;
      try {
        msg = JSON.parse(raw.toString());
      } catch {
        ws.close(1003, "invalid json");
        return;
      }

      if (msg.role === "viewer" || msg.client === "viewer") {
        viewers.add(ws);
        console.log(`[call-stream] Viewer connected. Total viewers: ${viewers.size}`);
        ws.on("close", () => {
          viewers.delete(ws);
          console.log(`[call-stream] Viewer disconnected. Total viewers: ${viewers.size}`);
        });
        return;
      }

      if (msg.event === "connected") {
        await handleTwilioMediaStream(ws, lang, broadcastTranscript);
        return;
      }

      ws.close(1008, "expected role viewer or Twilio connected event");
    });
  });
}

async function handleTwilioMediaStream(twilioWs, lang, broadcastTranscript) {
  const key = process.env.DEEPGRAM_API_KEY;
  if (!key) {
    console.error(
      "[call-stream] DEEPGRAM_API_KEY missing — caller audio will not be transcribed"
    );
    twilioWs.on("message", () => {});
    return;
  }

  let dgSocket;
  let dgReady = false;

  try {
    const dgUrl = `wss://api.deepgram.com/v1/listen?model=nova-2&language=${lang || 'en'}&encoding=mulaw&sample_rate=8000&channels=1&interim_results=true&smart_format=true&punctuate=true`;
    logToFile(`[call-stream] Attempting RAW Deepgram connect: ${dgUrl.split('?')[0]}...`);
    
    dgSocket = new WebSocket(dgUrl, {
      headers: {
        Authorization: `Token ${key}`,
      },
    });
    
    // Explicitly wait for the OPEN event before proceeding
    await new Promise((resolve, reject) => {
      const connTimeout = setTimeout(() => reject(new Error("Deepgram RAW OPEN timeout (15s)")), 15000);
      
      dgSocket.on("open", () => {
        clearTimeout(connTimeout);
        dgReady = true;
        logToFile("[call-stream] Deepgram RAW socket OPENED");
        resolve();
      });

      dgSocket.on("error", (err) => {
        clearTimeout(connTimeout);
        logToFile(`[call-stream] Deepgram RAW socket error: ${err.message || err}`);
        reject(err);
      });
    });

    logToFile("[call-stream] Deepgram RAW connection fully ESTABLISHED");
  } catch (e) {
    logToFile(`[call-stream] Deepgram connect FATAL ERROR: ${e.message || e}`);
    if (dgSocket && dgSocket.readyState === WebSocket.OPEN) {
      try { dgSocket.close(); } catch(_) {}
    }
    return;
  }

  // Raw WebSocket uses "message" event
  dgSocket.on("message", (raw) => {
    try {
      const data = JSON.parse(raw.toString());
      const ch = data.channel;
      const alt = ch?.alternatives?.[0];
      const transcript = String(alt?.transcript || "").trim();
      
      if (transcript) {
        logToFile(`[call-stream] DG Result: "${transcript}" (final: ${data.is_final})`);
        
        // Broadcast both final AND interim results for better real-time feel
        broadcastTranscript(transcript, data.is_final);
      }
    } catch (err) {
      logToFile(`[call-stream] Error processing DG result: ${err}`);
    }
  });

  // Raw event listeners
  dgSocket.on("close", (code, reason) => logToFile(`[call-stream] DG Connection Closed. Code: ${code}, Reason: ${reason || 'none'}`));

  twilioWs.on("message", (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw.toString());
    } catch {
      return;
    }
    if (msg.event === "media" && msg.media?.payload) {
      const track = msg.media.track;
      if (track && track !== "inbound") return;
      const buf = Buffer.from(msg.media.payload, "base64");
      try {
        if (!dgReady || dgSocket.readyState !== WebSocket.OPEN) {
          if (Math.random() < 0.01) {
            logToFile("[call-stream] Warning: Dropping audio, Deepgram RAW socket not yet OPEN");
          }
          return;
        }
        // Minimal logging to avoid spam but confirm flow
        if (Math.random() < 0.05) { 
          logToFile(`[call-stream] Forwarding audio chunk (${buf.length} bytes) to Deepgram RAW`);
        }
        dgSocket.send(buf);
      } catch (err) {
        logToFile(`[call-stream] send error: ${err.message || err}`);
      }
    } else if (msg.event === "start") {
      logToFile(`[call-stream] Twilio stream START event: ${JSON.stringify(msg.start)}`);
    } else if (msg.event === "stop") {
      logToFile("[call-stream] Twilio stream STOP event");
      try {
        dgSocket.close();
      } catch (_) {}
    }
  });

  twilioWs.on("close", () => {
    try {
      dgSocket.close();
    } catch (_) {}
  });
}

module.exports = { attachCallStreamHub };

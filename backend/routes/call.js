const express = require("express");
const { logToFile } = require("../utils/logger");
const twilio = require("twilio");

const router = express.Router();
const fs = require("fs");
const path = require("path");


function missingTwilioEnvKeys() {
  const missing = [];
  if (!process.env.TWILIO_ACCOUNT_SID?.trim()) missing.push("TWILIO_ACCOUNT_SID");
  if (!process.env.TWILIO_AUTH_TOKEN?.trim()) missing.push("TWILIO_AUTH_TOKEN");
  if (!process.env.TWILIO_PHONE_NUMBER?.trim()) missing.push("TWILIO_PHONE_NUMBER");
  return missing;
}

/** Public base URL Twilio can reach (no trailing slash). */
function resolvePublicBaseUrl(req) {
  const explicit = (process.env.TUNNEL_URL || "").trim().replace(/\/$/, "");
  if (explicit) return explicit;
  const proto = req.get("x-forwarded-proto") || req.protocol || "http";
  const host = req.get("x-forwarded-host") || req.get("host") || "";
  return `${proto}://${host}`.replace(/\/$/, "");
}

function isUnreachableFromTwilio(baseUrl) {
  try {
    const { hostname } = new URL(baseUrl);
    const h = hostname.toLowerCase();
    return h === "localhost" || h === "127.0.0.1" || h === "::1";
  } catch {
    return true;
  }
}

/** Build wss:// URL from public https base (Twilio Media Streams require wss when using https tunnels). */
function toMediaStreamWsUrl(httpsOrHttpBase) {
  const base = httpsOrHttpBase.replace(/\/$/, "");
  const wsOrigin = base.replace(/^https/i, "wss").replace(/^http/i, "ws");
  return `${wsOrigin}/api/call/stream`;
}

function escapeXmlText(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// Helper to get fresh Twilio client from Env
function getTwilioClient() {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  if (!accountSid || !authToken) return null;
  try {
    return twilio(accountSid, authToken);
  } catch (err) {
    console.error(`[call] Twilio SDK initialization failed:`, err.message);
    return null;
  }
}

/**
 * Endpoint to initiate a call from the browser to a real phone number.
 */
router.post("/dial", async (req, res) => {
  const missing = missingTwilioEnvKeys();
  if (missing.length > 0) {
    return res.status(503).json({
      error: `Add to backend/.env: ${missing.join(", ")} (from Twilio Console).`,
      code: "TWILIO_CONFIG_MISSING",
      missing,
    });
  }

  const client = getTwilioClient();
  if (!client) {
    return res.status(503).json({
      error: "Twilio client could not be created. Check TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN.",
      code: "TWILIO_CLIENT_FAILED",
    });
  }

  let { to, lang } = req.body;

  if (!to) {
    return res.status(400).json({ error: "Destination number 'to' is required.", code: "VALIDATION" });
  }

  const tunnelUrl = resolvePublicBaseUrl(req);
  if (isUnreachableFromTwilio(tunnelUrl)) {
    return res.status(400).json({
      error:
        "Twilio cannot reach localhost. Set TUNNEL_URL in backend/.env to your public HTTPS base URL (e.g. https://abc123.ngrok-free.app) and restart the server. Start ngrok with: ngrok http 3001",
      code: "NEEDS_PUBLIC_TUNNEL",
      hint: tunnelUrl,
    });
  }

  // Ensure E.164 format for Twilio
  if (!to.startsWith("+")) to = "+" + to;
  const twilioPhone = process.env.TWILIO_PHONE_NUMBER.trim();
  const from = twilioPhone.startsWith("+") ? twilioPhone : "+" + twilioPhone;

  try {
    const call = await client.calls.create({
      url: `${tunnelUrl}/call/twiml?lang=${encodeURIComponent(lang)}`,
      to,
      from,
      statusCallback: `${tunnelUrl}/call/status`,
      statusCallbackEvent: ["completed", "failed", "busy", "no-answer"],
    });

    console.log(`[call] Call initiated to ${to}. SID: ${call.sid}. Webhook base: ${tunnelUrl}`);
    return res.status(200).json({ sid: call.sid, status: "dialing" });
  } catch (err) {
    console.error(`[call] Twilio dialing error:`, err);
    const twilioCode = err.code ?? err.status;
    const payload = {
      error: err.message || "Twilio rejected the call request.",
      code: "TWILIO_REST_ERROR",
    };
    if (twilioCode !== undefined) payload.twilioCode = twilioCode;
    if (process.env.NODE_ENV === "development" && err.moreInfo) {
      payload.moreInfo = err.moreInfo;
    }
    return res.status(502).json(payload);
  }
});

/**
 * TwiML endpoint - accepts both GET and POST from Twilio.
 * If Twilio cannot parse this or gets HTML (e.g. ngrok warning), callers hear
 * "An application error has occurred".
 */
router.all("/twiml", (req, res) => {
  try {
    logToFile(`[call] >>> TwiML HIT! Method: ${req.method}`);
    const VoiceResponse = twilio.twiml.VoiceResponse;
    const response = new VoiceResponse();
    const lang = String(req.query.lang || "").slice(0, 20);

    const tunnelUrl = resolvePublicBaseUrl(req).replace(/\/$/, "");
    const streamDisabled =
      String(process.env.VOICE_RELAY_MEDIA_STREAM || "").toLowerCase() === "0" ||
      String(process.env.VOICE_RELAY_MEDIA_STREAM || "").toLowerCase() === "false";

    const sayOpts = { language: lang };
    if (lang === "hi-IN") sayOpts.voice = "Google.hi-IN-Standard-A";
    else if (lang === "te-IN") sayOpts.voice = "Google.te-IN-Standard-A";
    else sayOpts.voice = "Polly.Salli";

    if (streamDisabled) {
      response.say(
        sayOpts,
        "Voice2Sense relay is connected in audio-only test mode. Media stream is disabled in server settings."
      );
      response.pause({ length: 600 });
      res.type("text/xml; charset=utf-8");
      return res.status(200).send(response.toString());
    }

    const wsUrl = toMediaStreamWsUrl(tunnelUrl);
    logToFile(`[call] TwiML request received. Stream: ${wsUrl}`);

    response.say(sayOpts, "Connecting to Voice2Sense Relay. Please speak when ready.");

    const connect = response.connect();
    const stream = connect.stream({ url: wsUrl });
    stream.parameter({ name: "lang", value: lang });

    response.pause({ length: 3600 });

    const xml = response.toString();
    res.type("text/xml; charset=utf-8");
    return res.status(200).send(xml);
  } catch (err) {
    console.error("[call] TwiML handler error:", err);
    logToFile(`[call] TwiML ERROR: ${err.message || err}`);
    const VoiceResponse = twilio.twiml.VoiceResponse;
    const fallback = new VoiceResponse();
    fallback.say(
      "Voice2Sense could not build the call script. Check server logs and Twilio debugger."
    );
    res.type("text/xml; charset=utf-8");
    return res.status(200).send(fallback.toString());
  }
});

/**
 * Endpoint for the frontend to send text that should be spoken into the active phone call.
 */
router.post("/speak", async (req, res) => {
  const client = getTwilioClient();
  if (!client) return res.status(500).json({ error: "Twilio not configured" });

  const { sid, text, lang } = req.body;
  if (!sid || !text) return res.status(400).json({ error: "SID and text required" });

  try {
    const call = await client.calls(sid).fetch();
    console.log(`[call] Current status of ${sid}: ${call.status}`);

    if (call.status !== 'in-progress') {
      return res.status(400).json({ 
        error: `Call is ${call.status}. Please wait for the recipient to answer before speaking.` 
      });
    }

    const tunnelUrl = resolvePublicBaseUrl(req);
    if (isUnreachableFromTwilio(tunnelUrl)) {
      return res.status(400).json({
        error:
          "Set TUNNEL_URL in backend/.env to a public HTTPS URL so Twilio can open the media stream WebSocket.",
        code: "NEEDS_PUBLIC_TUNNEL",
      });
    }
    const wsUrl = toMediaStreamWsUrl(tunnelUrl);
    const safeText = escapeXmlText(text);
    const safeLang = String(lang || "").replace(/[^\w-]/g, "").slice(0, 20);

    console.log(`[call] Speaking into call ${sid} [${safeLang}]`);

    let voiceAttr = 'voice="Polly.Salli"';
    if (safeLang === "hi-IN") {
      voiceAttr = 'voice="Google.hi-IN-Standard-A"';
    } else if (safeLang === "te-IN") {
      voiceAttr = 'voice="Google.te-IN-Standard-A"';
    }

    const streamDisabled =
      String(process.env.VOICE_RELAY_MEDIA_STREAM || "").toLowerCase() === "0" ||
      String(process.env.VOICE_RELAY_MEDIA_STREAM || "").toLowerCase() === "false";

    const twimlBody = streamDisabled
      ? `<Response><Say language="${safeLang}" ${voiceAttr}>${safeText}</Say><Pause length="600"/></Response>`
      : `<Response>
          <Say language="${safeLang}" ${voiceAttr}>${safeText}</Say>
          <Connect>
            <Stream url="${wsUrl.replace(/&/g, "&amp;")}">
              <Parameter name="lang" value="${safeLang}" />
            </Stream>
          </Connect>
          <Pause length="3600" />
        </Response>`;

    await client.calls(sid).update({ twiml: twimlBody });

    res.status(200).json({ ok: true });
  } catch (err) {
    console.error(`[call] Speak error:`, err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * Endpoint for Twilio to send status updates about the call.
 */
router.post("/status", (req, res) => {
  const { CallSid, CallStatus, CallDuration, Cause } = req.body;
  logToFile(`[call-status] Call ${CallSid} is ${CallStatus}. Duration: ${CallDuration}s. Cause: ${Cause || 'N/A'}`);
  res.sendStatus(200);
});

/**
 * Dev-only: verify env is loaded (no secrets returned). GET /call/diagnostics
 */
router.get("/diagnostics", (req, res) => {
  if (process.env.NODE_ENV === "production") {
    return res.status(404).json({ error: "Not found" });
  }
  const missing = missingTwilioEnvKeys();
  let tunnelHost = null;
  try {
    tunnelHost = new URL(resolvePublicBaseUrl(req)).hostname;
  } catch {
    tunnelHost = "(invalid TUNNEL_URL)";
  }
  return res.json({
    twilioEnvOk: missing.length === 0,
    missingKeys: missing,
    tunnelHost,
    tunnelReachableByTwilio: !isUnreachableFromTwilio(resolvePublicBaseUrl(req)),
    deepgramConfigured: Boolean(process.env.DEEPGRAM_API_KEY?.trim()),
    hint:
      missing.length > 0
        ? "Fix missing keys in backend/.env and restart node."
        : !process.env.TUNNEL_URL?.trim()
          ? "TUNNEL_URL is unset; derived URL may be localhost (Twilio cannot use it)."
          : "If dial still fails, check Twilio Console errors and that ngrok is running and matches TUNNEL_URL.",
  });
});

module.exports = router;

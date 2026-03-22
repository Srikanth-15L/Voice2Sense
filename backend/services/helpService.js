const Groq = require("groq-sdk");

const DEFAULT_MODEL = "llama-3.1-8b-instant";

function getClient() {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    const err = new Error("GROQ_API_KEY is not configured");
    err.statusCode = 500;
    err.code = "CONFIG_ERROR";
    throw err;
  }
  return new Groq({ apiKey });
}

function buildSystemPrompt(context) {
  const lang = String(context?.sourceLanguage ?? "en");
  const targets = Array.isArray(context?.targetLanguages)
    ? context.targetLanguages.join(", ")
    : "";
  const expert = context?.expertMode != null ? String(context.expertMode) : "Normal";
  const room = context?.roomId != null ? String(context.roomId) : "";

  if (context.chatPurpose === "general") {
    return `You are Voice2Sense Guide. You answer general questions on any topic (within safety: no illegal or harmful instructions) AND you explain Voice2Sense features: real-time captions, Indian languages, privacy mode, room links, translation/sentiment in the side panel, relay phone calls, Twilio setup, and using the mic for captions.

Rules:
- Be clear and concise; use short paragraphs or bullets when helpful.
- If you do not know something, say so instead of guessing.
- You cannot hear the user's microphone or see their screen; you only have this chat and the context below.
- User "Speaking in" language code: ${lang}. Translation targets: ${targets || "none"}. Expert mode: ${expert}.${room ? ` Room id (for link sharing): ${room}.` : ""}`;
  }

  return `You are Voice2Sense Relay Assistant: help with live captioning, accessibility, and PSTN phone relay (dialing, speaking text into an active call, caller transcripts). User's caption language context: ${lang}. Be concise and practical. Expert mode: ${expert}.`;
}

/**
 * Conversational replies: general Q&A (chatPurpose general) or relay-focused (relay).
 */
async function answerHelpQuestion(message, history = [], context = {}) {
  const client = getClient();
  const model = process.env.GROQ_MODEL || DEFAULT_MODEL;
  const system = buildSystemPrompt(context);

  const msgs = [{ role: "system", content: system }];
  for (const h of history) {
    const role = h.role === "user" ? "user" : "assistant";
    const content = String(h.content || "").trim();
    if (content) msgs.push({ role, content });
  }
  msgs.push({ role: "user", content: String(message).trim() });

  const maxTokens = context.chatPurpose === "general" ? 1024 : 512;
  const completion = await client.chat.completions.create({
    model,
    messages: msgs,
    temperature: context.chatPurpose === "general" ? 0.45 : 0.35,
    max_tokens: maxTokens,
  });

  const text = completion.choices[0]?.message?.content?.trim();
  if (!text) {
    const err = new Error("Empty response from model");
    err.statusCode = 502;
    throw err;
  }
  return text;
}

module.exports = { answerHelpQuestion };

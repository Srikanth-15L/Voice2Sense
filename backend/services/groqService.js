const Groq = require("groq-sdk");

const DEFAULT_MODEL = "llama-3.1-8b-instant";

function parseModelJson(raw) {
  const trimmed = raw.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (fence) return JSON.parse(fence[1].trim());
    throw new Error("PARSE_FAIL");
  }
}

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

/**
 * One Groq chat completion that cleans text, translates, scores sentiment, and summarizes.
 * @param {{ text: string, targetLanguage: string }} input
 * @returns {Promise<{ original_cleaned: string, translation: string, sentiment: string, summary: string }>}
 */
async function analyzeText({ text, targetLanguage }) {
  let parsed;
  try {
    const client = getClient();
    const model = process.env.GROQ_MODEL || DEFAULT_MODEL;

    const system = `You are a precise text processor. You MUST respond with a single valid JSON object only — no markdown fences, no commentary.
The JSON must have exactly these keys:
- "original_cleaned": string — the input cleaned: trim whitespace, fix obvious spacing, use sentence case or title case as appropriate, normalize punctuation (proper periods, commas, apostrophes).
- "translation": string — full translation of the ORIGINAL user text (not the cleaned version) into the requested target language. Preserve meaning.
- "sentiment": string — exactly one of: "positive", "neutral", "negative" (overall polarity of the utterance).
- "sentimentEmoji": string — exactly ONE Unicode emoji that best matches how the speaker sounds emotionally in THIS specific utterance (tone of voice implied by words). Examples: 😊 joy, 😢 sadness, 😠 frustration, 😰 worry, 🤔 thinking, 😮 surprise, 🙏 thanks, 😌 relief, 🤝 agreement, 😐 flat/neutral, 💼 formal, 🎉 excitement. Pick by conversational content, not only polarity.
- "summary": string — one or two short sentences summarizing the original in English.

Rules:
- sentiment must be lowercase and one of the three allowed values.
- sentimentEmoji must be a single emoji character (or one ZWJ sequence like 👍🏽 if needed for skin tone).
- If target language is English, translation can match the original meaning in natural English.`;

    const user = `Target language for translation: ${targetLanguage}

Input text (string):
${JSON.stringify(text)}`;

    const completion = await client.chat.completions.create({
      model,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      temperature: 0.2,
      max_tokens: 2048,
      response_format: { type: "json_object" },
    });

    const raw = completion.choices[0]?.message?.content;
    if (!raw || typeof raw !== "string") {
      const err = new Error("Empty response from model");
      err.statusCode = 502;
      err.code = "MODEL_EMPTY";
      throw err;
    }

    try {
      parsed = parseModelJson(raw);
    } catch {
      const err = new Error("Model returned invalid JSON");
      err.statusCode = 502;
      err.code = "MODEL_PARSE";
      throw err;
    }
  } catch (err) {
    if (typeof err.status === "number" && err.status > 0) {
      const upstream = err.status;
      const e = new Error(err.message || "Groq API error");
      e.statusCode =
        upstream >= 500
          ? 502
          : upstream === 429
            ? 429
            : upstream === 401
              ? 401
              : 400;
      e.code =
        upstream === 429
          ? "GROQ_RATE_LIMIT"
          : upstream === 401
            ? "GROQ_AUTH"
            : "GROQ_API_ERROR";
      throw e;
    }
    throw err;
  }

  const allowed = ["positive", "neutral", "negative"];
  const sentiment = String(parsed.sentiment || "")
    .toLowerCase()
    .trim();
  if (!allowed.includes(sentiment)) {
    const err = new Error('Invalid sentiment in model output');
    err.statusCode = 502;
    err.code = "MODEL_SCHEMA";
    throw err;
  }

  const sentimentEmoji = normalizeSentimentEmoji(
    parsed.sentimentEmoji,
    sentiment
  );

  return {
    original_cleaned: String(parsed.original_cleaned ?? "").trim(),
    translation: String(parsed.translation ?? "").trim(),
    sentiment,
    sentimentEmoji,
    summary: String(parsed.summary ?? "").trim(),
  };
}

/** First grapheme from model, else polarity fallback. */
function normalizeSentimentEmoji(raw, sentiment) {
  const t = String(raw ?? "").trim();
  if (t) {
    const chars = Array.from(t);
    if (chars[0]) return chars[0];
  }
  const pol = String(sentiment || "neutral").toLowerCase();
  if (pol === "positive") return "😊";
  if (pol === "negative") return "😟";
  return "😐";
}

module.exports = { analyzeText, DEFAULT_MODEL };

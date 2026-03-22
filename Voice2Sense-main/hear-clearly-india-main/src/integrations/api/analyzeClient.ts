import { INDIAN_LANGUAGES } from "@/types/voice2sense";

export type AnalyzeResult = {
  translations: Record<string, string>;
  sentiment: string;
  sentimentEmoji: string;
  actionItems: string[];
  summary: string;
  original_cleaned?: string;
};

function resolveAnalyzeUrl(): string {
  const base = import.meta.env.VITE_API_URL?.replace(/\/$/, "");
  if (base) return `${base}/analyze`;
  return "/api/analyze";
}

function codeToTargetLanguageName(code: string): string {
  const lang = INDIAN_LANGUAGES.find((l) => l.code === code);
  return lang?.name ?? code;
}

function formatSentimentForUi(raw: string): string {
  const s = raw.toLowerCase().trim();
  if (s === "positive") return "Positive";
  if (s === "negative") return "Negative";
  if (s === "neutral") return "Neutral";
  return raw;
}

type BackendAnalyzeResponse = {
  original_cleaned: string;
  translation: string;
  sentiment: string;
  sentimentEmoji?: string;
  summary: string;
};

async function postAnalyze(
  text: string,
  targetLanguage: string
): Promise<BackendAnalyzeResponse> {
  const res = await fetch(resolveAnalyzeUrl(), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, targetLanguage }),
  });

  const data = (await res.json().catch(() => ({}))) as {
    error?: string;
    original_cleaned?: string;
    translation?: string;
    sentiment?: string;
    sentimentEmoji?: string;
    summary?: string;
  };

  if (!res.ok) {
    throw new Error(data.error || res.statusText || "Analyze request failed");
  }

  const sentiment = String(data.sentiment ?? "neutral");
  return {
    original_cleaned: String(data.original_cleaned ?? ""),
    translation: String(data.translation ?? ""),
    sentiment,
    sentimentEmoji: pickSentimentEmoji(data.sentimentEmoji, sentiment),
    summary: String(data.summary ?? ""),
  };
}

function pickSentimentEmoji(raw: string | undefined, sentiment: string): string {
  const t = String(raw ?? "").trim();
  if (t) {
    const first = Array.from(t)[0];
    if (first) return first;
  }
  const s = sentiment.toLowerCase();
  if (s === "positive") return "😊";
  if (s === "negative") return "😟";
  return "😐";
}

/**
 * Calls the Express `/analyze` endpoint (one request per target language, in parallel).
 * `expertMode` is accepted for API compatibility with the UI; the current backend
 * performs a single combined prompt and does not vary by expert mode.
 */
export async function analyzeText(
  text: string,
  _sourceLanguage: string,
  targetLanguages: string[],
  _expertMode: string = "Normal"
): Promise<AnalyzeResult | null> {
  if (!targetLanguages.length) return null;

  try {
    const results = await Promise.all(
      targetLanguages.map(async (code) => {
        const name = codeToTargetLanguageName(code);
        const data = await postAnalyze(text, name);
        return { code, data };
      })
    );

    const translations: Record<string, string> = {};
    let sentiment = "neutral";
    let sentimentEmoji = "😐";
    let summary = "";
    let original_cleaned = "";

    for (const { code, data } of results) {
      translations[code] = data.translation;
      sentiment = data.sentiment;
      sentimentEmoji = data.sentimentEmoji;
      summary = data.summary;
      original_cleaned = data.original_cleaned;
    }

    return {
      translations,
      sentiment: formatSentimentForUi(sentiment),
      sentimentEmoji,
      actionItems: [],
      summary,
      original_cleaned,
    };
  } catch (err) {
    console.error("AI Analysis failed:", err);
    return null;
  }
}

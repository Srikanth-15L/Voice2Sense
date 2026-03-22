const express = require("express");
const { analyzeText } = require("../services/groqService");

const router = express.Router();

function validateBody(body) {
  if (!body || typeof body !== "object") {
    return { error: "Request body must be a JSON object", status: 400 };
  }
  const { text, targetLanguage } = body;
  if (text === undefined || text === null) {
    return { error: "Field \"text\" is required", status: 400 };
  }
  if (typeof text !== "string") {
    return { error: "Field \"text\" must be a string", status: 400 };
  }
  if (text.length > 32000) {
    return { error: "Field \"text\" exceeds maximum length", status: 400 };
  }
  if (targetLanguage === undefined || targetLanguage === null) {
    return { error: "Field \"targetLanguage\" is required", status: 400 };
  }
  if (typeof targetLanguage !== "string" || !targetLanguage.trim()) {
    return { error: "Field \"targetLanguage\" must be a non-empty string", status: 400 };
  }
  return null;
}

router.post("/", async (req, res) => {
  const validation = validateBody(req.body);
  if (validation) {
    return res.status(validation.status).json({
      error: validation.error,
      code: "VALIDATION_ERROR",
    });
  }

  const { text, targetLanguage } = req.body;

  try {
    const result = await analyzeText({
      text: text.trim(),
      targetLanguage: targetLanguage.trim(),
    });

    if (!result.original_cleaned && !result.translation) {
      return res.status(502).json({
        error: "Model produced empty fields",
        code: "MODEL_EMPTY_FIELDS",
      });
    }

    return res.status(200).json({
      original_cleaned: result.original_cleaned,
      translation: result.translation,
      sentiment: result.sentiment,
      sentimentEmoji: result.sentimentEmoji,
      summary: result.summary,
    });
  } catch (err) {
    const status = err.statusCode ?? err.status ?? 500;
    const code = err.code || "INTERNAL_ERROR";
    const message =
      status === 500 && process.env.NODE_ENV !== "development"
        ? "An unexpected error occurred"
        : err.message || "Request failed";

    if (status >= 500) {
      console.error("[analyze]", err);
    }

    return res.status(status).json({
      error: message,
      code,
    });
  }
});

module.exports = router;

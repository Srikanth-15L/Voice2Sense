const express = require("express");
const { answerHelpQuestion } = require("../services/helpService");

const router = express.Router();

router.post("/", async (req, res) => {
  const { message, history, context } = req.body || {};
  if (message === undefined || message === null || typeof message !== "string") {
    return res.status(400).json({
      error: 'Field "message" is required and must be a string',
      code: "VALIDATION_ERROR",
    });
  }
  const trimmed = message.trim();
  if (!trimmed) {
    return res.status(400).json({
      error: "message must not be empty",
      code: "VALIDATION_ERROR",
    });
  }

  try {
    const answer = await answerHelpQuestion(
      trimmed,
      Array.isArray(history) ? history : [],
      context && typeof context === "object" ? context : {}
    );
    return res.status(200).json({ answer });
  } catch (err) {
    const status = err.statusCode ?? 500;
    if (status >= 500) {
      console.error("[help]", err);
    }
    return res.status(status).json({
      error: err.message || "Request failed",
      code: err.code || "INTERNAL_ERROR",
    });
  }
});

module.exports = router;

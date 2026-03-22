const path = require("path");
require("dotenv").config({ path: path.join(__dirname, ".env") });
const { answerHelpQuestion } = require("./services/helpService");

async function test(msg, personality = "support") {
  try {
    console.log(`Testing with personality: ${personality}...`);
    const history = [
      { role: "user", text: "Hello" },
      { role: "assistant", text: "Hi! How can I help you today?" }
    ];
    const context = {
      sourceLanguage: "hi",
      isRecording: false,
      expertMode: "normal"
    };
    
    const answer = await answerHelpQuestion(msg, history, context, personality);
    console.log("Success! Answer:", answer);
  } catch (err) {
    console.error("Caught error:", err);
  }
}

async function runAll() {
  await test("What is the current language?", "support");
  process.exit(0);
}

runAll();

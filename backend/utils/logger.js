const fs = require("fs");
const path = require("path");

function logToFile(msg) {
  const line = `[${new Date().toISOString()}] ${msg}\n`;
  try {
    fs.appendFileSync(path.join(__dirname, "..", "debug.log"), line);
  } catch (err) {}
  console.log(msg);
}

module.exports = { logToFile };

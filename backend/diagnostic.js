require('dotenv').config();
const { DeepgramClient } = require('@deepgram/sdk');

async function test() {
  if (!process.env.DEEPGRAM_API_KEY) {
    console.error("DEEPGRAM_API_KEY missing");
    process.exit(1);
  }
  const deepgram = new DeepgramClient(process.env.DEEPGRAM_API_KEY);
  try {
    console.log("Connecting (te-IN)...");
    const dgSocket = await deepgram.listen.v1.connect({
        model: "nova-2",
        language: "te-IN",
    });
    console.log("Connected!");
    
    dgSocket.on("message", (msg) => {
        console.log("DG Message received:", typeof msg === 'string' ? msg : JSON.stringify(msg).substring(0, 100));
    });

    dgSocket.on("error", (err) => console.error("DG Error:", err));

    // Wait for open? connect resolves when connected.
    console.log("Sending dummy audio via .socket.send...");
    const dummy = Buffer.alloc(16000, 1);
    
    if (dgSocket.socket && typeof dgSocket.socket.send === 'function') {
        dgSocket.socket.send(dummy);
        console.log("Sent successfully via .socket.send");
    } else {
        console.error("dgSocket.socket.send not found!");
    }
    
    setTimeout(() => {
        console.log("Closing...");
        process.exit(0);
    }, 5000);
  } catch (err) {
    console.error("Connection failed:", err);
    process.exit(1);
  }
}

test();

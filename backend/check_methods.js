require('dotenv').config();
const { DeepgramClient } = require('@deepgram/sdk');

const dg = new DeepgramClient(process.env.DEEPGRAM_API_KEY);
console.log("dg.listen.live type:", typeof dg.listen.live);
console.log("dg.listen.v1.connect type:", typeof dg.listen.v1.connect);
process.exit(0);

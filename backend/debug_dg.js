require('dotenv').config();
const { DeepgramClient, LiveTranscriptionEvents } = require('@deepgram/sdk');
const dg = new DeepgramClient(process.env.DEEPGRAM_API_KEY);

async function run() {
  const s = await dg.listen.v1.connect({ model: 'nova-2', language: 'en-US' });
  
  s.on('message', () => console.log('EVENT: message'));
  s.on('Results', () => console.log('EVENT: Results'));
  s.on(LiveTranscriptionEvents.Transcript, () => console.log('EVENT: Transcript Event'));
  
  s.on('open', () => {
    console.log('Open! Sending dummy audio payload to trigger transcript...');
    const dummy = Buffer.alloc(16000, 1);
    
    if (s.send) s.send(dummy);
    else if (s.socket && s.socket.send) s.socket.send(dummy);
    
    setTimeout(() => {
        if (s.finish) s.finish();
        process.exit(0);
    }, 2000);
  });
}
run();

require('dotenv').config();
const { DeepgramClient } = require('@deepgram/sdk');
const dg = new DeepgramClient(process.env.DEEPGRAM_API_KEY);

async function run() {
  console.log('Connecting to Deepgram...');
  const s = await dg.listen.v1.connect({ model: 'nova-2', language: 'en-US' });
  
  s.on('Open', () => {
    console.log('EVENT: Open');
    // Send 1 second of dummy silence (mulaw)
    const dummy = Buffer.alloc(8000, 0xff); 
    s.send(dummy);
    setTimeout(() => {
        s.finish();
        console.log('Finished.');
        process.exit(0);
    }, 2000);
  });

  s.on('Results', (data) => {
    console.log('EVENT: Results', JSON.stringify(data));
  });

  s.on('Metadata', (data) => {
    console.log('EVENT: Metadata', JSON.stringify(data));
  });

  s.on('Error', (err) => {
    console.error('EVENT: Error', err);
  });

  s.on('Close', () => {
    console.log('EVENT: Close');
  });
}
run().catch(console.error);

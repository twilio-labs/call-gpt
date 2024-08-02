require('dotenv').config();
require('colors');

const path = require('path');

const express = require('express');
const ExpressWs = require('express-ws');

const { GptService } = require('./services/gpt-service');
const { TextService } = require('./services/text-service');
const { recordingService } = require('./services/recording-service');
const { tokenGenerator } = require('./services/token-generator');

const app = express();
ExpressWs(app);

const PORT = process.env.PORT || 3000;
app.use(express.static('public'));


app.get('/index.html', (req, res) => {
  res.sendFile(path.join(__dirname, './index.html'));
});

app.get('/token', (req, res) => {
  res.send(tokenGenerator());
});

app.post('/incoming', (req, res) => {
  try {
    const response = `<Response>
      <Connect>
        <Voxray
          url="wss://${process.env.SERVER}/sockets"
          welcomePrompt="Hi! Ask me anything!"
          voice="Google.en-US-Wavenet-G"
        />
      </Connect>
    </Response>`;
    res.type('text/xml');
    res.end(response.toString());
  } catch (err) {
    console.log(err);
  }
});

app.ws('/sockets', (ws) => {
  try {
    ws.on('error', console.error);
    // Filled in from start message
    let streamSid;
    let callSid;

    const gptService = new GptService();
    const textService = new TextService(ws);

    let interactionCount = 0;
    
    // Incoming from MediaStream
    ws.on('message', function message(data) {
      const msg = JSON.parse(data);
      console.log(msg);
      if (msg.type === 'setup') {
        callSid = msg.callSid;        
        gptService.setCallSid(callSid);

        // Set RECORDING_ENABLED='true' in .env to record calls
        recordingService(textService, callSid).then(() => {
          console.log(`Twilio -> Starting Media Stream for ${streamSid}`.underline.red);
        });
      } else if (msg.type === 'prompt') {
        gptService.completion(msg.voicePrompt, interactionCount);
        interactionCount += 1;
      } else if (msg.type === 'interrupt') {
        gptService.interrupt();
        console.log('Todo: add interruption handling');
      }
    });
    
    gptService.on('gptreply', async (gptReply, final, icount) => {
      console.log(`Interaction ${icount}: GPT -> TTS: ${gptReply.partialResponse}`.green );
      textService.sendText(gptReply, final);
    });
  } catch (err) {
    console.log(err);
  }
});

app.listen(PORT);
console.log(`Server running on port ${PORT}`);

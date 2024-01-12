require('dotenv').config();
const express = require('express');
const ExpressWs = require('express-ws');
const uuid = require('uuid');

const { GptService } = require('./services/gpt-service');
const { StreamService } = require('./services/stream-service');
const { TranscriptionService } = require('./services/transcription-service');
const { TextToSpeechService } = require('./services/tts-service');
const { FirebaseService } = require('./services/fb-service');

const app = express();
ExpressWs(app);
app.use(express.static('public'));
const PORT = process.env.PORT || 3000;
let fbid = '';
let conId = '';

const fbService = new FirebaseService();

app.post('/incoming', (req, res) => {
  conId = uuid.v4();
  res.status(200);
  res.type('text/xml');
  res.end(`
  <Response>
    <Connect>
      <Stream url="wss://${process.env.SERVER}/connection" />
    </Connect>
  </Response>
  `);
});

app.ws('/connection', (ws) => {
  ws.on('error', console.error);
  // Filled in from start message
  let streamSid;

  const gptService = new GptService();
  const streamService = new StreamService(ws);
  const transcriptionService = new TranscriptionService();
  const ttsService = new TextToSpeechService({});

  let marks = [];
  let interactionCount = 0;

  // Incoming from MediaStream
  ws.on('message', (data) => {
    const msg = JSON.parse(data);
    if (msg.event === 'start') {
      streamSid = msg.start.streamSid;
      streamService.setStreamSid(streamSid);
      console.log(`Starting Media Stream for ${streamSid}`);
      ttsService.generate({ partialResponseIndex: null, partialResponse: "Hello! I understand you're looking for a pair of AirPods, is that correct?" }, 1);
    } else if (msg.event === 'media') {
      transcriptionService.send(msg.media.payload);
    } else if (msg.event === 'mark') {
      const label = msg.mark.name;
      console.log(`Media completed mark (${msg.sequenceNumber}): ${label}`);
      marks = marks.filter((m) => m !== msg.mark.name);
    } else if (msg.event === 'stop') {
      console.log(`Media stream ${streamSid} ended.`);
    }
  });

  transcriptionService.on('utterance', async (text) => {
    // This is a bit of a hack to filter out empty utterances
    if (marks.length > 0 && text?.length > 5) {
      console.log('Interruption, Clearing stream');
      ws.send(
        JSON.stringify({
          streamSid,
          event: 'clear',
        }),
      );
    }
  });

  transcriptionService.on('transcription', async (text, startdt, enddt) => {
    if (!text) { return; }
    console.log(`Interaction ${interactionCount} – STT -> GPT: ${text}`);
    fbid = uuid.v4();
    if (text) {
      fbService.setLogs(text, fbid, conId, 'Deepgram', startdt, enddt);
      fbService.setTranscript(text, fbid, conId, 'phone');
    }

    gptService.completion(text, interactionCount);
    interactionCount += 1;
  });

  gptService.on('gptreply', async (gptReply, icount, startdt, enddt) => {
    console.log(`Interaction ${icount}: GPT -> TTS: ${gptReply.partialResponse}`);
    fbid = uuid.v4();
    if (gptReply) {
      fbService.setLogs(gptReply.partialResponse, fbid, conId, 'OpenAI', startdt, enddt);
      fbService.setTranscript(gptReply.partialResponse, fbid, conId, 'bot');
    }

    ttsService.generate(gptReply, icount);
  });

  ttsService.on('speech', (responseIndex, audio, label, icount, startdt, enddt) => {
    console.log(`Interaction ${icount}: TTS -> TWILIO: ${label}`);
    fbid = uuid.v4();
    if (label) {
      fbService.setLogs(label, fbid, conId, 'ElevenLabs', startdt, enddt);
    }
    streamService.buffer(responseIndex, audio);
  });

  streamService.on('audiosent', (markLabel) => {
    marks.push(markLabel);
  });
});

app.get('/getSessionId', (req, res) => {
  res.json([{ id: conId }]);
});

app.get('/getAllTranscripts', async (req, res) => {
  // res.send("this is a test" + conId);
  const alltrans = await fbService.getAllTranscripts();
  if (alltrans) {
    const readfs = alltrans;
    res.json(readfs);
  }
});

app.get('/getAllLogs', async (req, res) => {
  // res.send("this is a test" + conId);
  const alllogs = await fbService.getAllLogs();
  if (alllogs) {
    const readfs = alllogs;
    res.json(readfs);
  }
});

app.get('/getTranscriptById', async (req, res) => {
  // res.send("this is a test" + conId);
  // const response = "This is a test " + conId;
  const response = await fbService.getTranscriptById('11ee566c-880d-4708-8261-c95f947e0faf');

  res.json(response);
});

app.listen(PORT);
console.log(`Server running on port ${PORT}`);

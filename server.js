require("dotenv").config();
const express = require("express");
const ExpressWs = require("express-ws");

const { TextToSpeechService } = require("./tts-service");
const { TranscriptionService } = require("./transcription-service");

const app = express();
ExpressWs(app);

const PORT = 3000;

app.post("/incoming", (req, res) => {
  res.status(200);
  res.type("text/xml");
  res.end(`
  <Response>
    <Connect>
      <Stream url="wss://${process.env.SERVER}/connection" />
    </Connect>
  </Response>
  `);
});

app.ws("/connection", (ws, req) => {
  ws.on("error", console.error);
  // Filled in from start message
  let streamSid;

  const transcriptionService = new TranscriptionService();
  const ttsService = new TextToSpeechService({});

  // Incoming from MediaStream
  ws.on("message", function message(data) {
    const msg = JSON.parse(data);
    if (msg.event === "start") {
      streamSid = msg.start.streamSid;
      console.log(`Starting Media Stream for ${streamSid}`);
    } else if (msg.event === "media") {
      transcriptionService.send(msg.media.payload);
    } else if (msg.event === "mark") {
      const label = msg.mark.name;
      console.log(`Media completed mark (${msg.sequenceNumber}): ${label}`)
    }
  });

  transcriptionService.on("transcription", (text) => {
    console.log(`Received transcription: ${text}`);
    ttsService.generate(text);
  });

  ttsService.on("speech", (audio, label) => {
    console.log(`Sending audio to Twilio ${audio.length} b64 characters`);
    ws.send(
      JSON.stringify({
        streamSid,
        event: "media",
        media: {
          payload: audio,
        },
      })
    );
    // When the media completes you will receive a `mark` message with the label
    ws.send(
      JSON.stringify({
        streamSid,
        event: "mark",
        mark: {
          name: label
        }
      })
    )
  });
});

app.listen(PORT);
console.log(`Server running on port ${PORT}`);

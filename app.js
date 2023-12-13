require("dotenv").config();
const express = require("express");
const ExpressWs = require("express-ws");
const uuid = require('uuid');

const { TextToSpeechService } = require("./services/tts-service");
const { TranscriptionService } = require("./services/transcription-service");
const { GptService } = require("./services/gpt-service");

const app = express();
ExpressWs(app);

const PORT = process.env.PORT || 3000;

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

// <Play>https://maize-earwig-4391.twil.io/assets/ElevenLabs_2023-12-01T06_57_02_Rachel_pre_s50_sb75_se0_b_m2.mp3</Play>


app.ws("/connection", (ws, req) => {
  ws.on("error", console.error);
  // Filled in from start message
  let streamSid;

  const gptService = new GptService();
  const transcriptionService = new TranscriptionService();
  const ttsService = new TextToSpeechService({});
  
  let marks = []
  let interactionCount = 0

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
      marks = marks.filter(m => m !== msg.mark.name)
    } else if (msg.event === "stop") {
      console.log(`Media stream ${streamSid} ended.`)
    }
  });

  transcriptionService.on("utterance", async (text) => {
    // This is a bit of a hack to filter out empty utterances
    if(marks.length > 0 && text?.length > 3) {
      console.log("Interruption, Clearing stream")
      ws.send(
        JSON.stringify({
          streamSid,
          event: "clear",
        })
      );
    }
  });

  transcriptionService.on("transcription", async (text) => {
    if (!text) { return; }
    console.log(`Interaction ${interactionCount} – STT -> GPT: ${text}`);
    gptService.completion(text, interactionCount);
    interactionCount += 1;
  });
  
  gptService.on('gptreply', async (text, icount) => {
    console.log(`Interaction ${icount}: GPT -> TTS: ${text}` )
    ttsService.generate(text, icount);
  });

  ttsService.on("speech", (audio, label, icount) => {
    console.log(`Interaction ${icount}: TTS -> TWILIO: ${label}`);
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
    const markLabel = uuid.v4()
    ws.send(
      JSON.stringify({
        streamSid,
        event: "mark",
        mark: {
          name: markLabel
        }
      })
    )
    marks.push(markLabel)
  });
});

app.listen(PORT);
console.log(`Server running on port ${PORT}`);

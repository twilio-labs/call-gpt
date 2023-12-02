require("dotenv").config();
const express = require("express");
const ExpressWs = require("express-ws");
const OpenAI = require('openai');
const uuid = require('uuid');

const { TextToSpeechService } = require("./tts-service");
const { TranscriptionService } = require("./transcription-service");

const app = express();
ExpressWs(app);

const PORT = 3000;
const openai = new OpenAI();


app.post("/incoming", (req, res) => {
  res.status(200);
  res.type("text/xml");
  res.end(`
  <Response>
    <Play>https://maize-earwig-4391.twil.io/assets/ElevenLabs_2023-12-01T06_57_02_Rachel_pre_s50_sb75_se0_b_m2.mp3</Play>
    <Connect>
      <Stream url="wss://${process.env.SERVER}/connection" />
    </Connect>
  </Response>
  `);
});

async function getGPTResponse(text, ttsService) {
  const stream = await openai.chat.completions.create({
    model: "gpt-4",
    messages: [
      {"role": "system", "content": "You are a helpful assistant chatting with a user on the phone. Keep your responses cheerful and brief."},
      {"role": "user", "content": text}
    ],
    stream: true,
  });

  let textBuffer = ""
  for await (const chunk of stream) {
    let content = chunk.choices[0]?.delta?.content || ""
    if(content.slice(-1) === "." || content.slice(-1) === "!") {
      console.log(textBuffer)
      await ttsService.generate(textBuffer)
      textBuffer = ""
    } else {
      textBuffer += content 
    }
  }
}

app.ws("/connection", (ws, req) => {
  ws.on("error", console.error);
  // Filled in from start message
  let streamSid;

  const transcriptionService = new TranscriptionService();
  const ttsService = new TextToSpeechService({});
  let marks = []
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
      marks = marks.filter(m => m === msg.mark.name)
    }
  });

  transcriptionService.on("utterance", async (text) => {
    if(marks.length > 0 && text.length > 5) {
      console.log("Interruption, Clearing stream")
      ws.send(
        JSON.stringify({
          streamSid,
          event: "clear",
        })
      );
    }
  })

  transcriptionService.on("transcription", async (text) => {
    console.log(`Received final transcription: ${text}`);
    if (text) {
      await getGPTResponse(text, ttsService)
    }
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

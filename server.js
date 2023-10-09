const { WebSocketServer } = require("ws");
const { Deepgram } = require("@deepgram/sdk");

const PORT = 8080;

const wss = new WebSocketServer({
  port: PORT,
});

wss.on("connection", function connection(ws) {
  ws.on("error", console.error);
  const deepgram = new Deepgram(process.env.DEEPGRAM_API_KEY);
  const deepgramLive = deepgram.transcription.live({
    encoding: "mulaw",
    sample_rate: "8000",
    model: "nova",
    interim_results: false
  });

  // Incoming from MediaStream
  ws.on("message", function message(data) {
    const msg = JSON.parse(data);
    if (msg.event === "start") {
      console.log(`Starting Media Stream`);
    } else if (msg.event === "media") {
      // TODO: Buffer up the media and then send
      if (deepgramLive.getReadyState() === 1) {
        //console.log(`Sending for ${data}`);
        deepgramLive.send(Buffer.from(msg.media.payload, "base64"));
      }
    }
  });

  deepgramLive.addListener("error", (error) => {
    console.error("deepgram error");
    console.error(error);
  });


  deepgramLive.addListener("transcriptReceived", (transcriptionMessage) => {
    const transcription = JSON.parse(transcriptionMessage);
    //console.log(`transcriptionMessage: ${transcriptionMessage}`);
    console.log(transcription.channel?.alternatives[0]?.transcript);
  });

  deepgramLive.addListener("close", () => {
    console.log("Deepgram connection closed");
  });


  // ws.send("something");
});

console.log(`WebSocket Server running on port ${PORT}`);

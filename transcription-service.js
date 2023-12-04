const { Deepgram } = require("@deepgram/sdk");
const EventEmitter = require("events");


class TranscriptionService extends EventEmitter {
  constructor() {
    super();
    const deepgram = new Deepgram(process.env.DEEPGRAM_API_KEY);
    this.deepgramLive = deepgram.transcription.live({
      encoding: "mulaw",
      sample_rate: "8000",
      model: "nova",
      punctuate: true,
      interim_results: true,
      endpointing: 500,
    });
    this.deepgramLive.addListener("transcriptReceived", (transcriptionMessage) => {
      const transcription = JSON.parse(transcriptionMessage);
      const text = transcription.channel?.alternatives[0]?.transcript;
      if (transcription.is_final === true) {
        if (text) {
          this.emit("transcription", text);
        }
      } else {
        this.emit("utterance", text);
      }
    });
    this.deepgramLive.addListener("error", (error) => {
      console.error("deepgram error");
      console.error(error);
    });
    this.deepgramLive.addListener("close", () => {
      console.log("Deepgram connection closed");
    });
  }

  /**
   * Send the payload to Deepgram
   * @param {String} payload A base64 MULAW/8000 audio stream
   */
  send(payload) {
    // TODO: Buffer up the media and then send
    if (this.deepgramLive.getReadyState() === 1) {
      this.deepgramLive.send(Buffer.from(payload, "base64"));
    }
  }
}

module.exports = { TranscriptionService }
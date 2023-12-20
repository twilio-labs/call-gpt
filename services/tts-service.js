const EventEmitter = require("events");
const fetch = require('node-fetch');

class TextToSpeechService extends EventEmitter {
  constructor(config) {
    super();
    this.config = config;
    this.config.voiceId ||= process.env.VOICE_ID;
  }

  async generate(text, interactionCount) {
    if (!text) { return; }

    try {
      const outputFormat = "ulaw_8000";
      const response = await fetch(
        `https://api.elevenlabs.io/v1/text-to-speech/${this.config.voiceId}/stream?output_format=${outputFormat}&optimize_streaming_latency=2`,
        {
          method: "POST",
          headers: {
            "xi-api-key": process.env.XI_API_KEY,
            "Content-Type": "application/json",
            accept: "audio/wav",
          },
          // TODO: Pull more config? https://docs.elevenlabs.io/api-reference/text-to-speech-stream
          body: JSON.stringify({
            model_id: process.env.XI_MODEL_ID,
            text,
          }),
        }
      );
      const audioArrayBuffer = await response.arrayBuffer();
      const label = text;
      this.emit("speech", Buffer.from(audioArrayBuffer).toString("base64"), label, interactionCount);
    } catch (err) {
      console.error("Error occurred in TextToSpeech service");
      console.error(err);
    }
  }
}

module.exports = { TextToSpeechService };

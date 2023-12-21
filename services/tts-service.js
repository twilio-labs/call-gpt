const EventEmitter = require("events");
const fetch = require('node-fetch');

class TextToSpeechService extends EventEmitter {
  constructor(config) {
    super();
    this.config = config;
    this.config.voiceId ||= process.env.VOICE_ID;
  }

  async generate(gptReply, interactionCount) {
    const { partialResponseIndex, partialResponse } = gptReply;

    if (!partialResponse) { return; }

      try {
          let startdt = new Date();
      const outputFormat = "ulaw_8000";
      const response = await fetch(
        `https://api.elevenlabs.io/v1/text-to-speech/${this.config.voiceId}/stream?output_format=${outputFormat}&optimize_streaming_latency=3`,
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
            text: partialResponse,
          }),
        }
      );
          const audioArrayBuffer = await response.arrayBuffer();
          let enddt = new Date();
      this.emit("speech", partialResponseIndex, Buffer.from(audioArrayBuffer).toString("base64"), partialResponse, interactionCount, startdt, enddt);
    } catch (err) {
      console.error("Error occurred in TextToSpeech service");
      console.error(err);
    }
  }
}

module.exports = { TextToSpeechService };

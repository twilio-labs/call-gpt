const EventEmitter = require("events");

const { WaveFile } = require("wavefile");

class TextToSpeechService extends EventEmitter {
  constructor(config) {
    super();
    this.config = config;
    this.config.voiceId ||= process.env.VOICE_ID;
  }

  async generate(text) {
    const outputFormat = "pcm_16000";
    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${this.config.voiceId}/stream?output_format=${outputFormat}`,
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
    console.log(`Response status from elevenlabs: ${response.status}`);
    try {
      const audioArrayBuffer = await response.arrayBuffer();
      const wav = new WaveFile();
      // TODO: I am not sure this is right (or how to know)
      wav.fromScratch(1, 16000, '16', new Int16Array(audioArrayBuffer));
      wav.toSampleRate(8000);
      wav.toMuLaw();
      const label = text;
      // Do not send the WAV headers (that's why `data.samples`)
      this.emit("speech", Buffer.from(wav.data.samples).toString("base64"), label);
    } catch (err) {
      console.error("Error occurred in TextToSpeech service");
      console.error(err);
    }
  }
}

module.exports = { TextToSpeechService };

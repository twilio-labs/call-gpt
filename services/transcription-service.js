require('colors');
const { createClient, LiveTranscriptionEvents } = require('@deepgram/sdk');
const { Buffer } = require('node:buffer');
const EventEmitter = require('events');


class TranscriptionService extends EventEmitter {
  constructor() {
    super();
    const deepgram = createClient(process.env.DEEPGRAM_API_KEY);
    this.dgConnection = deepgram.listen.live({
      encoding: 'mulaw',
      sample_rate: '8000',
      model: 'nova-2',
      punctuate: true,
      interim_results: true,
      endpointing: 200,
      utterance_end_ms: 1000
    });

    this.finalResult = '';
    this.speechFinal = false; // used to determine if we have seen speech_final=true indicating that deepgram detected a natural pause in the speakers speech. 

    this.dgConnection.on(LiveTranscriptionEvents.Open, () => {
      this.dgConnection.on(LiveTranscriptionEvents.Transcript, (transcriptionEvent) => {
        const alternatives = transcriptionEvent.channel?.alternatives;
        let text = '';
        if (alternatives) {
          text = alternatives[0]?.transcript;
        }
        
        // if we receive an UtteranceEnd and speech_final has not already happened then we should consider this the end of of the human speech and emit the transcription
        if (transcriptionEvent.type === 'UtteranceEnd') {
          if (!this.speechFinal) {
            console.log(`UtteranceEnd received before speechFinal, emit the text collected so far: ${this.finalResult}`.yellow);
            this.emit('transcription', this.finalResult);
            return;
          } else {
            console.log('STT -> Speech was already final when UtteranceEnd recevied'.yellow);
            return;
          }
        }
    
        // console.log(text, "is_final: ", transcription?.is_final, "speech_final: ", transcription.speech_final);
        // if is_final that means that this chunk of the transcription is accurate and we need to add it to the finalResult 
        if (transcriptionEvent.is_final === true && text.trim().length > 0) {
          this.finalResult += ` ${text}`;
          // if speech_final and is_final that means this text is accurate and it's a natural pause in the speakers speech. We need to send this to the assistant for processing
          if (transcriptionEvent.speech_final === true) {
            this.speechFinal = true; // this will prevent a utterance end which shows up after speechFinal from sending another response
            this.emit('transcription', this.finalResult);
            this.finalResult = '';
          } else {
            // if we receive a message without speechFinal reset speechFinal to false, this will allow any subsequent utteranceEnd messages to properly indicate the end of a message
            this.speechFinal = false;
          }
        } else {
          this.emit('utterance', text);
        }
      });

      this.dgConnection.on(LiveTranscriptionEvents.Error, (error) => {
        console.error('STT -> deepgram error');
        console.error(error);
      });

      this.dgConnection.on(LiveTranscriptionEvents.Warning, (warning) => {
        console.error('STT -> deepgram warning');
        console.error(warning);
      });

      this.dgConnection.on(LiveTranscriptionEvents.Metadata, (metadata) => {
        console.error('STT -> deepgram metadata');
        console.error(metadata);
      });

      this.dgConnection.on(LiveTranscriptionEvents.Close, () => {
        console.log('STT -> Deepgram connection closed'.yellow);
      });
    });
  }

  /**
   * Send the payload to Deepgram
   * @param {String} payload A base64 MULAW/8000 audio stream
   */
  send(payload) {
    if (this.dgConnection.getReadyState() === 1) {
      this.dgConnection.send(Buffer.from(payload, 'base64'));
    }
  }
}

module.exports = { TranscriptionService };
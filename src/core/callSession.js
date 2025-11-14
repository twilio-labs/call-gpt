const { RealtimeClient } = require('../openai/realtimeClient');
const EventEmitter = require('events');

/**
 * CallSession - Orchestrates audio flow between Twilio and OpenAI Realtime
 * Handles bidirectional streaming and interruption management
 */
class CallSession extends EventEmitter {
  constructor(twilioWs, streamSid, callSid) {
    super();

    this.twilioWs = twilioWs;
    this.streamSid = streamSid;
    this.callSid = callSid;

    this.openaiClient = null;
    this.isActive = true;
    this.isAISpeaking = false;

    // Track marks for interruption detection
    this.activeMark = null;
    this.markQueue = [];

    // Audio buffering
    this.audioBuffer = [];
    this.bufferFlushInterval = null;

    console.log(`[Session ${this.callSid}] Created`.green);
  }

  /**
   * Initialize OpenAI connection
   */
  async initialize(apiKey) {
    try {
      this.openaiClient = new RealtimeClient(apiKey);

      // Set up event handlers
      this.setupOpenAIEventHandlers();

      // Connect to OpenAI
      await this.openaiClient.connect();

      console.log(`[Session ${this.callSid}] Initialized and connected to OpenAI`.green);
      this.emit('initialized');

      return true;
    } catch (error) {
      console.error(`[Session ${this.callSid}] Failed to initialize:`, error.message);
      this.emit('error', error);
      throw error;
    }
  }

  /**
   * Set up OpenAI Realtime event handlers
   */
  setupOpenAIEventHandlers() {
    // Handle audio chunks from AI
    this.openaiClient.on('audio.delta', (base64Audio) => {
      this.sendAudioToTwilio(base64Audio);
    });

    // Handle speech detection
    this.openaiClient.on('speech.started', () => {
      console.log(`[Session ${this.callSid}] User started speaking`.magenta);
      this.handleUserSpeechStart();
    });

    this.openaiClient.on('speech.stopped', () => {
      console.log(`[Session ${this.callSid}] User stopped speaking`.magenta);
    });

    // Handle transcripts (for logging)
    this.openaiClient.on('user.transcript', (transcript) => {
      console.log(`[Session ${this.callSid}] User: "${transcript}"`.yellow);
      this.emit('user.message', transcript);
    });

    // Handle response completion
    this.openaiClient.on('response.done', (response) => {
      this.isAISpeaking = false;
      console.log(`[Session ${this.callSid}] AI response complete`.green);
    });

    this.openaiClient.on('audio.done', () => {
      this.isAISpeaking = false;
    });

    // Handle errors
    this.openaiClient.on('error', (error) => {
      console.error(`[Session ${this.callSid}] OpenAI error:`, error);
      this.emit('error', error);
    });

    // Handle disconnections
    this.openaiClient.on('disconnected', () => {
      console.log(`[Session ${this.callSid}] OpenAI disconnected`.red);
      this.emit('openai.disconnected');
    });
  }

  /**
   * Handle incoming audio from Twilio
   */
  handleTwilioAudio(base64Audio) {
    if (!this.openaiClient || !this.openaiClient.connected) {
      console.warn(`[Session ${this.callSid}] Cannot send audio - OpenAI not connected`);
      return;
    }

    // Forward audio directly to OpenAI
    this.openaiClient.sendAudio(base64Audio);
  }

  /**
   * Handle user starting to speak (potential interruption)
   */
  handleUserSpeechStart() {
    // If AI is speaking, interrupt it
    if (this.isAISpeaking || this.markQueue.length > 0) {
      console.log(`[Session ${this.callSid}] Interruption detected - clearing AI audio`.red);

      // Cancel OpenAI response
      this.openaiClient.cancelResponse();

      // Clear Twilio's audio queue
      this.clearTwilioAudio();

      this.isAISpeaking = false;
      this.markQueue = [];
    }
  }

  /**
   * Send audio from OpenAI to Twilio
   */
  sendAudioToTwilio(base64Audio) {
    if (!this.isActive) return;

    this.isAISpeaking = true;

    // Send media message to Twilio
    const mediaMessage = {
      event: 'media',
      streamSid: this.streamSid,
      media: {
        payload: base64Audio
      }
    };

    if (this.twilioWs && this.twilioWs.readyState === 1) {
      this.twilioWs.send(JSON.stringify(mediaMessage));
    }
  }

  /**
   * Send a mark to Twilio (for tracking audio playback)
   */
  sendMark(markName) {
    const markMessage = {
      event: 'mark',
      streamSid: this.streamSid,
      mark: {
        name: markName
      }
    };

    if (this.twilioWs && this.twilioWs.readyState === 1) {
      this.twilioWs.send(JSON.stringify(markMessage));
      this.markQueue.push(markName);
    }
  }

  /**
   * Handle mark acknowledgment from Twilio
   */
  handleMarkReceived(markName) {
    console.log(`[Session ${this.callSid}] Mark received: ${markName}`.blue);

    // Remove from queue
    this.markQueue = this.markQueue.filter(m => m !== markName);

    if (this.markQueue.length === 0) {
      this.isAISpeaking = false;
    }
  }

  /**
   * Clear Twilio's audio buffer (for interruptions)
   */
  clearTwilioAudio() {
    const clearMessage = {
      event: 'clear',
      streamSid: this.streamSid
    };

    if (this.twilioWs && this.twilioWs.readyState === 1) {
      this.twilioWs.send(JSON.stringify(clearMessage));
      console.log(`[Session ${this.callSid}] Cleared Twilio audio buffer`.red);
    }
  }

  /**
   * End the call session
   */
  async end() {
    console.log(`[Session ${this.callSid}] Ending session...`.yellow);

    this.isActive = false;

    // Disconnect OpenAI
    if (this.openaiClient) {
      this.openaiClient.disconnect();
      this.openaiClient = null;
    }

    // Clear any intervals
    if (this.bufferFlushInterval) {
      clearInterval(this.bufferFlushInterval);
    }

    // Close Twilio WebSocket
    if (this.twilioWs && this.twilioWs.readyState === 1) {
      this.twilioWs.close();
    }

    this.emit('ended');
    console.log(`[Session ${this.callSid}] Session ended`.red);
  }

  /**
   * Get session status
   */
  getStatus() {
    return {
      callSid: this.callSid,
      streamSid: this.streamSid,
      isActive: this.isActive,
      isAISpeaking: this.isAISpeaking,
      openaiConnected: this.openaiClient?.connected || false,
      twilioConnected: this.twilioWs?.readyState === 1,
      queuedMarks: this.markQueue.length
    };
  }
}

module.exports = { CallSession };

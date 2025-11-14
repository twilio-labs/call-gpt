const WebSocket = require('ws');
const EventEmitter = require('events');

/**
 * OpenAI Realtime API WebSocket Client
 * Handles direct speech-to-speech communication with gpt-4o-realtime-preview
 */
class RealtimeClient extends EventEmitter {
  constructor(apiKey) {
    super();
    this.apiKey = apiKey;
    this.ws = null;
    this.isConnected = false;
    this.sessionId = null;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 1000;
  }

  /**
   * Connect to OpenAI Realtime API
   */
  async connect() {
    return new Promise((resolve, reject) => {
      const url = 'wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-12-17';

      this.ws = new WebSocket(url, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'OpenAI-Beta': 'realtime=v1'
        }
      });

      this.ws.on('open', () => {
        console.log('[OpenAI] Connected to Realtime API'.green);
        this.isConnected = true;
        this.reconnectAttempts = 0;
        this.initializeSession();
        resolve();
      });

      this.ws.on('message', (data) => {
        try {
          const event = JSON.parse(data.toString());
          this.handleRealtimeEvent(event);
        } catch (error) {
          console.error('[OpenAI] Error parsing message:', error);
        }
      });

      this.ws.on('error', (error) => {
        console.error('[OpenAI] WebSocket error:', error.message);
        this.emit('error', error);
      });

      this.ws.on('close', () => {
        console.log('[OpenAI] Connection closed'.yellow);
        this.isConnected = false;
        this.emit('disconnected');
        this.handleReconnect();
      });

      // Timeout if connection takes too long
      setTimeout(() => {
        if (!this.isConnected) {
          reject(new Error('Connection timeout'));
        }
      }, 10000);
    });
  }

  /**
   * Initialize session with μ-law configuration
   */
  initializeSession() {
    const sessionConfig = {
      type: 'session.update',
      session: {
        modalities: ['text', 'audio'],
        instructions: `You are a natural, warm, low-latency voice assistant.
Speak clearly in short sentences.
Interpret audio directly, not from text.
Understand emotion and tone from caller's voice.
If user asks something you cannot do, respond calmly and steer them back.
Never mention transcripts. Never mention thinking. Just talk.
Pause slightly between thoughts.`,
        voice: 'alloy',
        input_audio_format: 'g711_ulaw',
        output_audio_format: 'g711_ulaw',
        input_audio_transcription: {
          model: 'whisper-1'
        },
        turn_detection: {
          type: 'server_vad',
          threshold: 0.5,
          prefix_padding_ms: 300,
          silence_duration_ms: 500
        },
        temperature: 0.8,
        max_response_output_tokens: 4096
      }
    };

    this.sendEvent(sessionConfig);
    console.log('[OpenAI] Session initialized with g711_ulaw'.green);
  }

  /**
   * Handle incoming events from OpenAI Realtime API
   */
  handleRealtimeEvent(event) {
    // Log events for debugging (except frequent audio deltas)
    if (event.type !== 'response.audio.delta') {
      console.log(`[OpenAI] Event: ${event.type}`.cyan);
    }

    switch (event.type) {
      case 'session.created':
        this.sessionId = event.session.id;
        this.emit('session.created', event.session);
        break;

      case 'session.updated':
        this.emit('session.updated', event.session);
        break;

      case 'input_audio_buffer.speech_started':
        console.log('[OpenAI] User started speaking'.magenta);
        this.emit('speech.started');
        break;

      case 'input_audio_buffer.speech_stopped':
        console.log('[OpenAI] User stopped speaking'.magenta);
        this.emit('speech.stopped');
        break;

      case 'conversation.item.input_audio_transcription.completed':
        const transcript = event.transcript;
        console.log(`[OpenAI] User said: "${transcript}"`.yellow);
        this.emit('user.transcript', transcript);
        break;

      case 'response.audio.delta':
        // This is the AI's voice audio chunk (base64 μ-law)
        if (event.delta) {
          this.emit('audio.delta', event.delta);
        }
        break;

      case 'response.audio.done':
        console.log('[OpenAI] Audio response complete'.green);
        this.emit('audio.done');
        break;

      case 'response.done':
        console.log('[OpenAI] Response complete'.green);
        this.emit('response.done', event.response);
        break;

      case 'response.text.delta':
        // Reasoning/thinking text (optional, for logging)
        this.emit('text.delta', event.delta);
        break;

      case 'response.output_item.done':
        this.emit('output.done', event.item);
        break;

      case 'error':
        console.error('[OpenAI] Error:', event.error);
        this.emit('error', event.error);
        break;

      case 'rate_limits.updated':
        // Track rate limits if needed
        this.emit('rate_limits', event.rate_limits);
        break;

      default:
        // Catch-all for other event types
        this.emit('event', event);
        break;
    }
  }

  /**
   * Send audio data to OpenAI (base64 μ-law)
   */
  sendAudio(base64Audio) {
    if (!this.isConnected) {
      console.warn('[OpenAI] Cannot send audio - not connected');
      return;
    }

    const event = {
      type: 'input_audio_buffer.append',
      audio: base64Audio
    };

    this.sendEvent(event);
  }

  /**
   * Commit audio buffer and trigger response
   */
  commitAudio() {
    this.sendEvent({
      type: 'input_audio_buffer.commit'
    });
  }

  /**
   * Clear the audio buffer (for interruptions)
   */
  clearAudioBuffer() {
    this.sendEvent({
      type: 'input_audio_buffer.clear'
    });
  }

  /**
   * Create a response manually
   */
  createResponse() {
    this.sendEvent({
      type: 'response.create',
      response: {
        modalities: ['text', 'audio'],
        instructions: 'Please assist the user.'
      }
    });
  }

  /**
   * Cancel ongoing response (for interruptions)
   */
  cancelResponse() {
    this.sendEvent({
      type: 'response.cancel'
    });
  }

  /**
   * Send an event to OpenAI
   */
  sendEvent(event) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(event));
    } else {
      console.warn('[OpenAI] Cannot send event - WebSocket not ready');
    }
  }

  /**
   * Handle reconnection logic
   */
  handleReconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);

      console.log(`[OpenAI] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`.yellow);

      setTimeout(() => {
        this.connect().catch(err => {
          console.error('[OpenAI] Reconnection failed:', err.message);
        });
      }, delay);
    } else {
      console.error('[OpenAI] Max reconnection attempts reached'.red);
      this.emit('max_reconnects_reached');
    }
  }

  /**
   * Close connection cleanly
   */
  disconnect() {
    console.log('[OpenAI] Disconnecting...'.yellow);
    this.reconnectAttempts = this.maxReconnectAttempts; // Prevent auto-reconnect

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    this.isConnected = false;
  }

  /**
   * Check if connected
   */
  get connected() {
    return this.isConnected && this.ws && this.ws.readyState === WebSocket.OPEN;
  }
}

module.exports = { RealtimeClient };

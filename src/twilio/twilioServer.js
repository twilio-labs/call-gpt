const express = require('express');
const ExpressWs = require('express-ws');
const { CallSession } = require('../core/callSession');

/**
 * Twilio MediaStream WebSocket Server
 * Handles incoming call connections and routes audio to OpenAI Realtime
 */
class TwilioServer {
  constructor(config = {}) {
    this.config = {
      port: config.port || process.env.PORT || 3000,
      openaiApiKey: config.openaiApiKey || process.env.OPENAI_API_KEY,
      serverUrl: config.serverUrl || process.env.SERVER
    };

    this.app = express();
    this.expressWs = ExpressWs(this.app);

    // Track active sessions
    this.sessions = new Map();

    this.setupMiddleware();
    this.setupRoutes();
  }

  /**
   * Set up Express middleware
   */
  setupMiddleware() {
    this.app.use(express.json());
    this.app.use(express.urlencoded({ extended: true }));

    // Health check endpoint
    this.app.get('/health', (req, res) => {
      res.json({
        status: 'ok',
        activeSessions: this.sessions.size,
        timestamp: new Date().toISOString()
      });
    });
  }

  /**
   * Set up routes
   */
  setupRoutes() {
    // Twilio webhook for incoming calls
    this.app.post('/incoming', this.handleIncomingCall.bind(this));

    // WebSocket endpoint for MediaStream
    this.app.ws('/connection', this.handleWebSocketConnection.bind(this));

    // Session status endpoint
    this.app.get('/sessions', (req, res) => {
      const sessions = Array.from(this.sessions.values()).map(session =>
        session.getStatus()
      );
      res.json({ sessions });
    });
  }

  /**
   * Handle incoming Twilio call
   */
  handleIncomingCall(req, res) {
    try {
      console.log('[Twilio] Incoming call'.green);

      const VoiceResponse = require('twilio').twiml.VoiceResponse;
      const response = new VoiceResponse();

      // Connect to our MediaStream WebSocket
      const connect = response.connect();
      connect.stream({
        url: `wss://${this.config.serverUrl}/connection`
      });

      res.type('text/xml');
      res.send(response.toString());

      console.log('[Twilio] TwiML response sent'.green);
    } catch (error) {
      console.error('[Twilio] Error handling incoming call:', error);
      res.status(500).send('Error processing call');
    }
  }

  /**
   * Handle WebSocket connection from Twilio MediaStream
   */
  handleWebSocketConnection(ws, req) {
    console.log('[Twilio] New WebSocket connection'.cyan);

    let session = null;
    let streamSid = null;
    let callSid = null;

    // Handle WebSocket errors
    ws.on('error', (error) => {
      console.error('[Twilio] WebSocket error:', error);
    });

    // Handle incoming messages from Twilio
    ws.on('message', async (data) => {
      try {
        const message = JSON.parse(data);

        switch (message.event) {
          case 'start':
            await this.handleStart(ws, message, (createdSession) => {
              session = createdSession;
              streamSid = message.start.streamSid;
              callSid = message.start.callSid;
            });
            break;

          case 'media':
            this.handleMedia(session, message);
            break;

          case 'mark':
            this.handleMark(session, message);
            break;

          case 'stop':
            await this.handleStop(session, streamSid);
            break;

          default:
            console.log(`[Twilio] Unknown event: ${message.event}`);
        }
      } catch (error) {
        console.error('[Twilio] Error processing message:', error);
      }
    });

    // Handle WebSocket close
    ws.on('close', async () => {
      console.log(`[Twilio] WebSocket closed for ${callSid || 'unknown call'}`.yellow);

      if (session) {
        await session.end();
        if (callSid) {
          this.sessions.delete(callSid);
        }
      }
    });
  }

  /**
   * Handle 'start' event from Twilio MediaStream
   */
  async handleStart(ws, message, callback) {
    const { streamSid, callSid, customParameters } = message.start;

    console.log(`[Twilio] Stream started`.green);
    console.log(`[Twilio] Stream SID: ${streamSid}`.gray);
    console.log(`[Twilio] Call SID: ${callSid}`.gray);

    // Create new call session
    const session = new CallSession(ws, streamSid, callSid);

    // Initialize OpenAI connection
    try {
      await session.initialize(this.config.openaiApiKey);

      // Store session
      this.sessions.set(callSid, session);

      // Set up session event handlers
      this.setupSessionEventHandlers(session);

      callback(session);

      console.log(`[Twilio] Session ready for ${callSid}`.green);
    } catch (error) {
      console.error(`[Twilio] Failed to initialize session:`, error);
      ws.close();
    }
  }

  /**
   * Handle 'media' event (incoming audio from caller)
   */
  handleMedia(session, message) {
    if (!session) {
      console.warn('[Twilio] Received media before session initialized');
      return;
    }

    const { payload } = message.media;

    // Forward audio to OpenAI via session
    session.handleTwilioAudio(payload);
  }

  /**
   * Handle 'mark' event (audio playback acknowledgment)
   */
  handleMark(session, message) {
    if (!session) return;

    const markName = message.mark.name;
    session.handleMarkReceived(markName);
  }

  /**
   * Handle 'stop' event (stream ended)
   */
  async handleStop(session, streamSid) {
    console.log(`[Twilio] Stream stopped: ${streamSid}`.yellow);

    if (session) {
      await session.end();
      this.sessions.delete(session.callSid);
    }
  }

  /**
   * Set up event handlers for session
   */
  setupSessionEventHandlers(session) {
    session.on('error', (error) => {
      console.error(`[Session ${session.callSid}] Error:`, error);
    });

    session.on('ended', () => {
      console.log(`[Session ${session.callSid}] Ended`.red);
      this.sessions.delete(session.callSid);
    });

    session.on('user.message', (message) => {
      // Log user messages (already logged in session, but can add analytics here)
    });

    session.on('openai.disconnected', () => {
      console.log(`[Session ${session.callSid}] OpenAI disconnected - ending call`.red);
      session.end();
    });
  }

  /**
   * Start the server
   */
  start() {
    return new Promise((resolve) => {
      this.server = this.app.listen(this.config.port, () => {
        console.log('='.repeat(60).cyan);
        console.log('🎙️  Twilio ↔ OpenAI Realtime Server'.cyan.bold);
        console.log('='.repeat(60).cyan);
        console.log(`✓ Server running on port ${this.config.port}`.green);
        console.log(`✓ WebSocket endpoint: /connection`.green);
        console.log(`✓ Health check: http://localhost:${this.config.port}/health`.green);
        console.log('='.repeat(60).cyan);
        console.log('Waiting for calls...'.yellow);
        resolve(this.server);
      });
    });
  }

  /**
   * Stop the server
   */
  async stop() {
    console.log('\nShutting down server...'.yellow);

    // End all active sessions
    for (const session of this.sessions.values()) {
      await session.end();
    }

    this.sessions.clear();

    // Close server
    if (this.server) {
      return new Promise((resolve) => {
        this.server.close(() => {
          console.log('Server stopped'.red);
          resolve();
        });
      });
    }
  }
}

module.exports = { TwilioServer };

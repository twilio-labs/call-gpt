# Twilio ↔ OpenAI Realtime Voice Agent

A **direct speech-to-speech** AI phone agent using Twilio Media Streams and OpenAI's Realtime API (`gpt-4o-realtime-preview`).

Unlike traditional chained architectures (STT → GPT → TTS), this implementation uses OpenAI's **multimodal Realtime API** which handles speech-to-text, reasoning, and text-to-speech **all in one model**, resulting in ultra-low latency and natural conversations.

## 🎯 Architecture Overview

```
Twilio Phone Call
      ↓
Twilio MediaStreams (μ-law audio, 8kHz)
      ↓
WebSocket Server (Node.js)
      ↓
OpenAI Realtime API (gpt-4o-realtime-preview)
      ↓
AI Voice Response (μ-law audio)
      ↓
Twilio MediaStreams
      ↓
Caller hears AI voice
```

### Key Features

- **Direct speech-to-speech**: No intermediate STT/TTS services
- **Ultra-low latency**: Audio streams directly between Twilio and OpenAI
- **Interruption handling**: AI stops talking when user starts speaking (barge-in)
- **Native μ-law support**: Uses `g711_ulaw` format for optimal Twilio compatibility
- **Clean separation**: Modular architecture with dedicated components
- **Production-ready**: Error handling, reconnection logic, graceful shutdown

## 📁 Project Structure

```
src/
├── index.js                    # Main entry point
├── twilio/
│   └── twilioServer.js        # WebSocket server for Twilio MediaStreams
├── openai/
│   └── realtimeClient.js      # OpenAI Realtime API WebSocket client
└── core/
    └── callSession.js         # Orchestrates audio flow between both
```

### Component Breakdown

#### `twilioServer.js`
- Express server with WebSocket support
- Handles incoming Twilio calls
- Routes audio to/from OpenAI via CallSession
- Manages session lifecycle

#### `realtimeClient.js`
- WebSocket client for OpenAI Realtime API
- Configures audio format (g711_ulaw)
- Handles incoming audio chunks from AI
- Manages reconnection and error handling

#### `callSession.js`
- Orchestrates bidirectional audio flow
- Manages interruption/barge-in logic
- Tracks audio playback state
- Coordinates cleanup on call end

## 🚀 Getting Started

### Prerequisites

- Node.js 16+
- Twilio account with a phone number
- OpenAI API key with Realtime API access
- ngrok (for local development)

### Installation

1. **Clone and install dependencies**

```bash
git clone <your-repo>
cd call-gpt
npm install
```

2. **Configure environment variables**

Copy the example file:

```bash
cp .env.realtime.example .env
```

Edit `.env`:

```env
OPENAI_API_KEY=sk-proj-your-actual-key
SERVER=your-ngrok-url.ngrok.io
PORT=3000
```

3. **Start ngrok** (in a separate terminal)

```bash
ngrok http 3000
```

Copy the ngrok URL (e.g., `abc123.ngrok.io`) and update `SERVER` in `.env`

4. **Start the server**

```bash
npm run realtime
```

Or for development with auto-restart:

```bash
npm run realtime:dev
```

You should see:

```
============================================================
🎙️  Twilio ↔ OpenAI Realtime Server
============================================================
✓ Server running on port 3000
✓ WebSocket endpoint: /connection
✓ Health check: http://localhost:3000/health
============================================================
Waiting for calls...
```

### Configure Twilio

1. Go to [Twilio Console](https://console.twilio.com/)
2. Navigate to **Phone Numbers → Manage → Active numbers**
3. Click your phone number
4. Under **Voice Configuration**:
   - **A call comes in**: Webhook
   - **URL**: `https://your-ngrok-url.ngrok.io/incoming`
   - **HTTP**: POST
5. Click **Save**

## 📞 Making a Test Call

1. Call your Twilio phone number
2. You should hear the AI agent greet you
3. Speak naturally - the AI will respond in real-time
4. Try interrupting the AI while it's speaking (barge-in)

## 🧩 How It Works

### Audio Flow

1. **Caller speaks** → Twilio sends μ-law audio chunks via WebSocket
2. **Server forwards** → Audio sent to OpenAI Realtime API
3. **OpenAI processes** → Model understands speech, thinks, generates response
4. **OpenAI returns** → μ-law audio chunks streamed back
5. **Server forwards** → Audio sent to Twilio MediaStream
6. **Caller hears** → AI voice in real-time

### Interruption Handling

When the user starts speaking while AI is talking:

1. OpenAI detects speech (`input_audio_buffer.speech_started`)
2. Server cancels ongoing AI response
3. Server clears Twilio's audio buffer
4. User's new speech is processed
5. AI responds to the new input

### Session Lifecycle

```
Call starts → Session created → OpenAI connected → Audio streaming
                                                         ↓
Call ends ← Session destroyed ← OpenAI disconnected ← Error/timeout
```

## 🛠️ Development

### Running Locally

```bash
npm run realtime:dev
```

### Health Check

```bash
curl http://localhost:3000/health
```

Response:

```json
{
  "status": "ok",
  "activeSessions": 2,
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

### View Active Sessions

```bash
curl http://localhost:3000/sessions
```

### Logs

The server outputs color-coded logs:

- 🟢 **Green**: Success events
- 🟡 **Yellow**: Warnings
- 🔴 **Red**: Errors
- 🔵 **Blue**: Audio events
- 🟣 **Magenta**: Speech detection
- 🟦 **Cyan**: WebSocket events

## 🎨 Customizing the AI Voice

Edit `src/openai/realtimeClient.js` in the `initializeSession()` method:

```javascript
session: {
  voice: 'shimmer',  // Options: alloy, echo, shimmer
  instructions: `Your custom prompt here`,
  temperature: 0.7,  // Lower = more consistent
  // ... other settings
}
```

### Available Voices

- `alloy` - Neutral, balanced
- `echo` - Warm, friendly
- `shimmer` - Clear, professional

## 🚢 Deployment

### Deploy to Fly.io

1. Install Fly CLI: https://fly.io/docs/hands-on/install-flyctl/

2. Create `fly.toml`:

```toml
app = "your-app-name"
primary_region = "sea"

[build]
  builder = "heroku/buildpacks:20"

[env]
  PORT = "3000"

[http_service]
  internal_port = 3000
  force_https = true
  auto_stop_machines = false
  auto_start_machines = true
  min_machines_running = 1

[[vm]]
  cpu_kind = "shared"
  cpus = 1
  memory_mb = 512
```

3. Deploy:

```bash
fly launch
fly secrets set OPENAI_API_KEY=sk-proj-your-key
fly secrets set SERVER=your-app-name.fly.dev
fly deploy
```

4. Update Twilio webhook to: `https://your-app-name.fly.dev/incoming`

### Deploy to Railway

1. Install Railway CLI: https://docs.railway.app/develop/cli

2. Deploy:

```bash
railway login
railway init
railway add
railway up
```

3. Set environment variables in Railway dashboard
4. Update Twilio webhook

### Deploy to Render

1. Connect your GitHub repo
2. Create a new Web Service
3. Set environment variables
4. Deploy
5. Update Twilio webhook

## 🔧 Troubleshooting

### "OpenAI connection timeout"

- Check your `OPENAI_API_KEY` is valid
- Ensure you have access to Realtime API
- Check network/firewall settings

### "No audio from AI"

- Verify `SERVER` environment variable is correct
- Check ngrok is running and URL matches
- Look for WebSocket errors in logs

### "Call drops immediately"

- Ensure Twilio webhook URL is correct
- Check server is running and accessible
- Review Twilio debugger: https://console.twilio.com/monitor/debugger

### "Audio is choppy"

- Check server resources (CPU/memory)
- Reduce concurrent sessions
- Use a server closer to your users

## 📊 Monitoring

### Key Metrics to Track

- Active sessions: `GET /sessions`
- Call duration
- OpenAI reconnection rate
- Audio latency (Twilio → OpenAI → Twilio)

### Error Handling

The server automatically handles:

- OpenAI disconnections (auto-reconnect)
- Twilio stream interruptions
- Network timeouts
- Invalid audio formats

## 🧪 Testing

### Unit Tests

```bash
npm test
```

### Manual Testing Checklist

- [ ] Call connects successfully
- [ ] AI responds to first utterance
- [ ] Interruption/barge-in works
- [ ] Call ends cleanly
- [ ] Multiple concurrent calls work
- [ ] Reconnection after network drop

## 🔐 Security Best Practices

1. **Never commit `.env`** - Add to `.gitignore`
2. **Rotate API keys** regularly
3. **Use HTTPS** for webhooks (required by Twilio)
4. **Rate limit** incoming calls if needed
5. **Monitor usage** to prevent abuse

## 📚 API Reference

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `OPENAI_API_KEY` | Yes | OpenAI API key with Realtime access |
| `SERVER` | Yes | Your server URL (without https://) |
| `PORT` | No | Server port (default: 3000) |

### Endpoints

#### `POST /incoming`
Twilio webhook for incoming calls. Returns TwiML.

#### `WS /connection`
WebSocket endpoint for Twilio MediaStreams.

#### `GET /health`
Health check endpoint.

#### `GET /sessions`
Returns active call sessions.

## 🤝 Contributing

Contributions welcome! Please:

1. Fork the repo
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## 📝 License

MIT License - see LICENSE file

## 🙏 Credits

Built with:
- [Twilio](https://www.twilio.com/) - Phone infrastructure
- [OpenAI Realtime API](https://platform.openai.com/docs/guides/realtime) - Speech-to-speech AI
- [Express](https://expressjs.com/) - Web framework
- [ws](https://github.com/websockets/ws) - WebSocket client

## 📞 Support

- GitHub Issues: [Create an issue](https://github.com/your-repo/issues)
- Twilio Docs: https://www.twilio.com/docs/voice/media-streams
- OpenAI Realtime Docs: https://platform.openai.com/docs/guides/realtime

---

**Ready to deploy your AI voice agent?** 🚀

Start with `npm run realtime` and call your Twilio number!

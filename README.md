# Generative AI Phone Calling

Generative AI is producing a bunch of fun new models for us devs to poke at. Did you know you can use these over the phone?

Twilio gives you a superpower called [Media Streams](https://twilio.com/media-streams). Media Streams provides a Websocket connection to both sides of a phone call. You can get audio streamed to you, process it, and send audio back.

This repo serves as a demo exploring three models:
- [Deepgram](https://deepgram.com/) for Speech to Text
- [elevenlabs](https://elevenlabs.io) for Text to Speech
- [OpenAI](https://openai.com) for GPT prompt completion

These service combine to create a voice application that is remarkably better at transcribing, understanding, and speaking than traditional IVR systems.

Features:
- Returns responses with low latency, typically 1 second by utilizing streaming.
- Allows the user to interrupt the GPT assistant and ask a different question.
- Maintains chat history with GPT.

## Setting up for Development
Sign up for Deepgram, ElevenLabs, and OpenAI. You'll need an API key for each service.

Use [ngrok](https://ngrok.com) to tunnel and then expose port `3000`

```bash
ngrok http 3000
```

Copy `.env.example` to `.env` and add all API keys.

Set `SERVER` to your tunneled ngrok URL

Install the necessary packages:

```bash
npm install
```

Start the web server:

```bash
npm run dev
```

Wire up your Twilio number using the console or CLI

```bash
twilio phone-numbers:update +18889876 --voice-url=https://your-server.ngrok.io/incoming
```

There is a [Stream](https://www.twilio.com/docs/voice/twiml/stream) TwiML verb that will connect a stream to your websocket server.

## Deploy via Fly.io
Fly.io is a hosting service similar to Heroku that simplifies the deployment process. Given Twilio Media Streams are sent and received from us-east-1, it's recommended to choose Fly's Ashburn, VA (IAD) region.

Deploy the app using the Fly.io CLI:
```bash
fly deploy
```

Import your secrets from your .env file to your deployed app:
```bash
fly secrets import < .env
```
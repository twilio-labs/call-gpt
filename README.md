# Generative AI Phone Calling

Generative AI is producing a bunch of fun new models for us devs to poke at. Did you know you can use these over the phone?

Twilio gives you a superpower called [Media Streams](https://twilio.com/media-streams) which gives you a Websocket connection to both sides of  a phone call. You can get audio streamed to you, process it, and send audio back.

This repo serves as WIP demo but is exploring two models using [Deepgram](https://deepgram.com/) for Speech to Text and the incredibly fun [elevenlabs](https://elevenlabs.io) for Text to Speech.

## Installation

Sign up for Deepgram and ElevenLabs

Use something like [ngrok](https://ngrok.com) to tunnel and then expose port `3000`

```bash
ngrok http 3000
```

Copy `.env.example` to `.env` and  update keys

Set `SERVER` to your tunneled URL

Install the necessary packages

```bash
npm install
```


Start the server

```bash
node server.js
```

Wire up your Twilio number using the console or CLI

```bash
twilio phone-numbers:update +18889876 --voice-url=https://your-server.ngrok.io/incoming
```

There is a `Connect` verb that will connect a stream to your websocket server

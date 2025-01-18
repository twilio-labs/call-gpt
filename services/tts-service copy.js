try {
  const response = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/21m00Tcm4TlvDq8ikWAM/stream?output_format=ulaw_8000&optimize_streaming_latency=3`,
    {
      method: 'POST',
      headers: {
        'xi-api-key': 'sk_c55c3bbf6b47473032ed4cf9441c5a7bdbf522cb1f8f4a00',
        'Content-Type': 'application/json',
        accept: 'audio/wav',
      },
      body: JSON.stringify({
        model_id: 'eleven_multilingual_v2',
        text: partialResponse,
      }),
    }
  );  
  
  if (response.status === 200) {
    const audioArrayBuffer = await response.arrayBuffer();
    this.emit('speech', partialResponseIndex, Buffer.from(audioArrayBuffer).toString('base64'), partialResponse, interactionCount);
  } else {
    console.log('Eleven Labs Error:');
    console.log(response);
  }
} catch (err) {
  console.error('Error occurred in XI LabsTextToSpeech service');
  console.error(err);
}
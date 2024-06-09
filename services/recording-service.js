
require('colors');

async function recordingService(ttsService, callSid) {
  try {
    if (process.env.RECORDING_ENABLED === 'true') {
      const client = require('twilio')(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
      
      ttsService.generate({partialResponseIndex: null, partialResponse: 'This call will be recorded.'}, 0);
      const recording = await client.calls(callSid)
        .recordings
        .create({
          recordingChannels: 'dual'
        });
          
      console.log(`Recording Created: ${recording.sid}`.red);
    }
  } catch (err) {
    console.log(err);
  }
}

module.exports = { recordingService };
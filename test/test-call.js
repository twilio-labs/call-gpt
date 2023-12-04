require("dotenv").config();

async function makeTestCall() {
  const VoiceResponse = require('twilio').twiml.VoiceResponse;
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  
  const client = require('twilio')(accountSid, authToken);
  
  let twiml = new VoiceResponse();
  twiml.pause({ length: 30 });
  twiml.say('Which came first, the invention of the telephone or SMS?')
  twiml.pause({ length: 30 });

  console.log(twiml.toString())
  
  await client.calls
    .create({
        twiml: twiml.toString(),
        to: process.env.FROM_NUMBER,
        from: process.env.TO_NUMBER
      })
    .then(call => console.log(call.sid));
}  

makeTestCall();
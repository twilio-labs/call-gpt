const EventEmitter = require("events");
const OpenAI = require('openai');

class GptService extends EventEmitter {
  constructor() {
    super();
    this.openai = new OpenAI();
    this.userContext = [
      {"role": "system", "content": "You are a helpful assistant chatting with a user on the phone. Keep your responses cheerful and brief. Add a '•' symbol every 5 to 10 words at natural pauses where your response can be split for text to speech."},
    ]
  }
  
  async completion(text, interactionCount) {
    try {
      this.userContext.push({"role": "user", "content": text})
  
      const stream = await this.openai.chat.completions.create({
        model: "gpt-4",
        messages: this.userContext,
        stream: true,
      });
    
      let completeResponse = ""
      let partialResponse = ""
  
      for await (const chunk of stream) {
        let content = chunk.choices[0]?.delta?.content || ""
        completeResponse += content;
        if(content.trim().slice(-1) === "•" || chunk.choices[0]?.finish_reason === "stop") {
          console.log(partialResponse)
          this.emit("gptreply", partialResponse, interactionCount);
          partialResponse = ""
        } else {
          partialResponse += content 
        }
      }
    
      this.userContext.push({"role": "assistant", "content": completeResponse})
    } catch (err) {
      console.log(err);
    }
  }

}

module.exports = { GptService }
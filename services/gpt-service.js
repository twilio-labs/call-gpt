const EventEmitter = require("events");
const OpenAI = require('openai');

class GptService extends EventEmitter {
  constructor() {
    super();
    this.openai = new OpenAI();
    this.userContext = [
      {"role": "system", "content": "You are a helpful assistant chatting with a user on the phone. Keep your responses cheerful and brief. If you receive a query that is not a complete sentence, respond with an empty string."},
    ]
  }

  async completion(text, interactionCount) {
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
      if(content.slice(-1) === "." || content.slice(-1) === "!") {
        console.log(partialResponse)
        this.emit("gptreply", partialResponse, interactionCount);
        partialResponse = ""
      } else {
        partialResponse += content 
      }
    }
  
    this.userContext.push({"role": "assistant", "content": completeResponse})
  }

}

module.exports = { GptService }
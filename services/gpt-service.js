const EventEmitter = require("events");
const colors = require('colors');
const OpenAI = require('openai');
const tools = require('../functions/function-manifest');

// Import all functions included in function manifest
// Note: the function name and file name must be the same
const availableFunctions = {}
tools.forEach((tool) => {
  functionName = tool.function.name;
  availableFunctions[functionName] = require(`../functions/${functionName}`);
});

class GptService extends EventEmitter {
  constructor() {
    super();
    this.openai = new OpenAI();
    this.userContext = [
      { "role": "system", "content": "You are an outbound sales representative selling Apple Airpods. You have a youthful and cheery personality. Keep your responses as brief as possible but make every attempt to keep the caller on the phone without being rude. Don't ask more than 1 question at a time. Don't make assumptions about what values to plug into functions. Ask for clarification if a user request is ambiguous. Speak out all prices to include the currency. Please help them decide between the airpods, airpods pro and airpods max by asking questions like 'Do you prefer headphones that go in your ear or over the ear?'. If they are trying to choose between the airpods and airpods pro try asking them if they need noise canceling. Once you know which model they would like ask them how many they would like to purchase and try to get them to place an order. You must add a '•' symbol every 5 to 10 words at natural pauses where your response can be split for text to speech." },
      { "role": "assistant", "content": "Hello! I understand you're looking for a pair of AirPods, is that correct?" },
    ],
    this.partialResponseIndex = 0
  }

  async completion(text, interactionCount, role = "user", name = "user") {
    if (name != "user") {
      this.userContext.push({ "role": role, "name": name, "content": text })
    } else {
      this.userContext.push({ "role": role, "content": text })
    }

    // Step 1: Send user transcription to Chat GPT
    const stream = await this.openai.chat.completions.create({
      // model: "gpt-4-1106-preview",
      model: "gpt-4",
      messages: this.userContext,
      tools: tools,
      stream: true,
    });

    let completeResponse = ""
    let partialResponse = ""
    let functionName = ""
    let functionArgs = ""
    let finishReason = ""

    for await (const chunk of stream) {
      let content = chunk.choices[0]?.delta?.content || ""
      let deltas = chunk.choices[0].delta

      // Step 2: check if GPT wanted to call a function
      if (deltas.tool_calls) {

        // Step 3: call the function
        let name = deltas.tool_calls[0]?.function?.name || "";
        if (name != "") {
          functionName = name;
        }
        let args = deltas.tool_calls[0]?.function?.arguments || "";
        if (args != "") {
          // args are streamed as JSON string so we need to concatenate all chunks
          functionArgs += args;
        }
      }
      // check to see if it is finished
      finishReason = chunk.choices[0].finish_reason;

      // need to call function on behalf of Chat GPT with the arguments it parsed from the conversation
      if (finishReason === "tool_calls") {
        // parse JSON string of args into JSON object
        try {
          functionArgs = JSON.parse(functionArgs)
        } catch (error) {
          // was seeing an error where sometimes we have two sets of args
          if (functionArgs.indexOf('{') != functionArgs.lastIndexOf('{'))
            functionArgs = JSON.parse(functionArgs.substring(functionArgs.indexOf(''), functionArgs.indexOf('}') + 1));
        }

        const functionToCall = availableFunctions[functionName];
        let functionResponse = functionToCall(functionArgs);

        // Step 4: send the info on the function call and function response to GPT
        this.userContext.push({
          role: 'function',
          name: functionName,
          content: functionResponse,
        });
        // extend conversation with function response

        // call the completion function again but pass in the function response to have OpenAI generate a new assistant response
        await this.completion(functionResponse, interactionCount, 'function', functionName);
      } else {
        // We use completeResponse for userContext
        completeResponse += content;
        // We use partialResponse to provide a chunk for TTS
        partialResponse += content;
        // Emit last partial response and add complete response to userContext
        if (content.trim().slice(-1) === "•" || finishReason === "stop") {
          const gptReply = { 
            partialResponseIndex: this.partialResponseIndex,
            partialResponse
          }

          this.emit("gptreply", gptReply, interactionCount);
          this.partialResponseIndex++;
          partialResponse = ""
        }
      }
    }
    this.userContext.push({"role": "assistant", "content": completeResponse})
    console.log(`GPT -> user context length: ${this.userContext.length}`.green)
  }
}

module.exports = { GptService }
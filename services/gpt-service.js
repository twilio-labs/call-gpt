const EventEmitter = require("events");
const OpenAI = require('openai');

function check_inventory(model) {
  console.log(model);
  if (model?.toLowerCase().includes("pro")) {
    return JSON.stringify({ stock: "10"});
  } else {
    return JSON.stringify({ stock: "100" });
  }
}

function place_order(model, quantity) {
  if (model === "airpods pro") {
    return JSON.stringify({orderNumber: "113491824", price: String(quantity * 199)});
  }
  return JSON.stringify({orderNumber: "113491824", price: String(quantity * 129)});
}

class GptService extends EventEmitter {
  constructor() {
    super();
    this.openai = new OpenAI();
    this.userContext = [
      { "role": "system", "content": "You are an outbound sales representative trying to sell Apple Airpods. You have a youthful and cheery personality. Keep your responses brief and make every attempt to keep the caller on the phone. Don't make assumptions about what values to plug into functions. Ask for clarification if a user request is ambiguous. If they say they are interested in the Airpods clairfy if they want the Airpods or Airpods Pro." },
    ]
  }

  async completion(text, interactionCount, role = "user", name = "user") {
    if (name != "user") {
      this.userContext.push({ "role": role, "name": name, "content": text })
    } else {
      this.userContext.push({ "role": role, "content": text })
    }

    const availableFunctions = {
      check_inventory: check_inventory,
      place_order: place_order,
    };

    const tools = [
      {
        type: "function",
        function: {
          name: "check_inventory",
          description: "Check the inventory of airpods or airpods pro.",
          parameters: {
            type: "object",
            properties: {
              model: {
                type: "string",
                "enum": ["airpods", "airpods pro"],
                description: "The model of airpods, either the regular or pro",
              },
            },
            required: ["model"],
          },
        },
      },
      {
        type: "function",
        function: {
          name: "place_order",
          description: "Check the inventory of airpods or airpods pro.",
          parameters: {
            type: "object",
            properties: {
              model: {
                type: "string",
                "enum": ["airpods", "airpods pro"],
                description: "The model of airpods, either the regular or pro",
              },
              quantity: {
                type: "integer",
                description: "The number of airpods they want to order",
              },
            },
            required: ["type", "quantity"],
          },
        },
      },
    ];

    // Step 1: Send user transcription to Chat GPT
    const stream = await this.openai.chat.completions.create({
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
        functionArgs = JSON.parse(functionArgs)

        const functionToCall = availableFunctions[functionName];

        // execute the function with args
        const functionResponse = functionToCall(
          functionArgs.location,
          functionArgs.unit
        );

        // Step 4: send the info on the function call and function response to GPT
        //messages.push(responseMessage); // extend conversation with assistant's reply
        this.userContext.push({
          role: 'function',
          name: functionName,
          content: functionResponse,
        }); // extend conversation with function response
        await this.completion(functionResponse, interactionCount, 'function', functionName);
      } else {
        completeResponse += content;
        
        // GPT is done streaming, emit last partial response and add complete response to userContext
        if (finishReason === "length" || finishReason === "stop") {
          this.emit("gptreply", partialResponse, interactionCount);
          this.userContext.push({ "role": "assistant", "content": completeResponse })
          return;
        } else { // GPT is still streaming
          // if we've reached the end of a sentence then emit that sentence to be spoken via TTS
          partialResponse += content
          if (content.slice(-1) === "." || content.slice(-1) === "!") {
            console.log(partialResponse)
            this.emit("gptreply", partialResponse, interactionCount);
            partialResponse = ""
          }
        }
      }
    }
  }
}

module.exports = { GptService }
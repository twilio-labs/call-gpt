// eslint-disable no-restricted-syntax

const EventEmitter = require('events');
const OpenAI = require('openai');
const tools = require('../config/tools');

// eslint-disable-next-line camelcase
function check_inventory(model) {
  console.log('\x1b[36m%s\x1b[0m', 'GPT -> called check_inventory');
  console.log({ model });
  if (model?.toLowerCase().includes('pro')) {
    return JSON.stringify({ stock: 10 });
  } if (model?.toLowerCase().includes('max')) {
    return JSON.stringify({ stock: 0 });
  }
  return JSON.stringify({ stock: 100 });
}

// eslint-disable-next-line camelcase
function check_price(model) {
  console.log('\x1b[36m%s\x1b[0m', 'GPT -> called check_price');
  console.log({ model });
  if (model?.toLowerCase().includes('pro')) {
    return JSON.stringify({ price: 249 });
  } if (model?.toLowerCase().includes('max')) {
    return JSON.stringify({ price: 549 });
  }
  return JSON.stringify({ price: 149 });
}

// eslint-disable-next-line camelcase
function place_order(model, quantity) {
  console.log('\x1b[36m%s\x1b[0m', 'GPT -> called place_order');
  console.log({ model }, { quantity });

  // generate a random order number that is 7 digits
  const orderNum = Math.floor(Math.random() * (9999999 - 1000000 + 1) + 1000000);

  // check model and return the order number and price with 7.9% sales tax
  if (model?.toLowerCase().includes('pro')) {
    return JSON.stringify({ orderNumber: orderNum, price: Math.floor(quantity * 249 * 1.079) });
  } if (model?.toLowerCase().includes('max')) {
    return JSON.stringify({ orderNumber: orderNum, price: Math.floor(quantity * 549 * 1.079) });
  }
  return JSON.stringify({ orderNumber: orderNum, price: Math.floor(quantity * 179 * 1.079) });
}

class GptService extends EventEmitter {
  constructor() {
    super();
    this.openai = new OpenAI();
    this.userContext = [
      { role: 'system', content: "You are an outbound sales representative selling Apple Airpods. You have a youthful and cheery personality. Keep your responses as brief as possible but make every attempt to keep the caller on the phone without being rude. Don't ask more than 1 question at a time. Don't make assumptions about what values to plug into functions. Ask for clarification if a user request is ambiguous. Speak out all prices to include the currency. Please help them decide between the airpods, airpods pro and airpods max by asking questions like 'Do you prefer headphones that go in your ear or over the ear?'. If they are trying to choose between the airpods and airpods pro try asking them if they need noise canceling. Once you know which model they would like ask them how many they would like to purchase and try to get them to place an order." },
      { role: 'assistant', content: "Hello! I understand you're looking for a pair of AirPods, is that correct?" },
    ];
    this.partialResponseIndex = 0;
  }

  async completion(text, interactionCount, role = 'user', name = 'user') {
    if (name !== 'user') {
      this.userContext.push({ role, name, content: text });
    } else {
      this.userContext.push({ role, content: text });
    }

    const availableFunctions = {
      // eslint-disable-next-line camelcase
      check_inventory,
      // eslint-disable-next-line camelcase
      check_price,
      // eslint-disable-next-line camelcase
      place_order,
    };

    // Step 1: Send user transcription to Chat GPT
    const stream = await this.openai.chat.completions.create({
      model: 'gpt-4-1106-preview',
      messages: this.userContext,
      tools,
      stream: true,
    });

    let completeResponse = '';
    let partialResponse = '';
    let functionName = '';
    let functionArgs = '';
    let finishReason = '';
    const startdt = new Date();
    // eslint-disable-next-line no-restricted-syntax
    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content || '';
      const deltas = chunk.choices[0].delta;

      // Step 2: check if GPT wanted to call a function
      if (deltas.tool_calls) {
        console.log(deltas.tool_calls);

        // Step 3: call the function
        const fname = deltas.tool_calls[0]?.function?.name || '';
        if (fname !== '') {
          functionName = fname;
        }
        const args = deltas.tool_calls[0]?.function?.arguments || '';
        if (args !== '') {
          // args are streamed as JSON string so we need to concatenate all chunks
          functionArgs += args;
        }
      }
      // check to see if it is finished
      finishReason = chunk.choices[0]?.finish_reason;

      /*
      Need to call function on behalf of Chat GPT with the
      arguments it parsed from the conversation
      */
      if (finishReason === 'tool_calls') {
        // console.log({functionArgs}, {functionName});
        // parse JSON string of args into JSON object
        try {
          functionArgs = JSON.parse(functionArgs);
        } catch (error) {
          // was seeing an error where sometimes we have two sets of args
          if (functionArgs.indexOf('{') !== functionArgs.lastIndexOf('{')) { functionArgs = JSON.parse(functionArgs.substring(functionArgs.indexOf(''), functionArgs.indexOf('}') + 1)); }
        }

        const functionToCall = availableFunctions[functionName];
        let functionResponse = null;
        // execute the correct function with the correct arguments
        if (functionName === 'check_inventory' || functionName === 'check_price') {
          functionResponse = functionToCall(
            functionArgs.model,
          );
        } else if (functionName === 'place_order') {
          functionResponse = functionToCall(
            functionArgs.model,
            functionArgs.quantity,
          );
        }
        // console.log({functionResponse})
        // Step 4: send the info on the function call and function response to GPT
        this.userContext.push({
          role: 'function',
          name: functionName,
          content: functionResponse,
        });
        // extend conversation with function response

        /*
        Call the completion function again but pass
        in the function response to have OpenAI generate
        a new assistant response
        */
        await this.completion(functionResponse, interactionCount, 'function', functionName);
      } else {
        // We use completeResponse for userContext
        completeResponse += content;
        // We use partialResponse to provide a chunk for TTS
        partialResponse += content;
        // Emit last partial response and add complete response to userContext
        if (content.trim().slice(-1) === '.'
            || content.trim().slice(-1) === '!'
            || content.trim().slice(-1) === '?'
            || content.trim().slice(-1) === ','
            || finishReason === 'stop') {
          const gptReply = {
            partialResponseIndex: this.partialResponseIndex,
            partialResponse,
          };
          const enddt = new Date();
          this.emit('gptreply', gptReply, interactionCount, startdt, enddt);
          this.partialResponseIndex += 1;
          partialResponse = '';
        }
      }
    }
    this.userContext.push({ role: 'assistant', content: completeResponse });
    console.log(`User context length: ${this.userContext.length}`);
    // console.log(this.userContext);
  }
}

module.exports = { GptService };

require('colors');
const EventEmitter = require('events');
const axios = require('axios');
const tools = require('../functions/function-manifest');

// Import all functions included in the function manifest
const availableFunctions = {};
tools.forEach((tool) => {
  let functionName = tool.function.name;
  availableFunctions[functionName] = require(`../functions/${functionName}`);
});

class LlamaService extends EventEmitter {
  constructor() {
    super();
    this.apiUrl = "http://localhost:11434/api/chat"; // LLaMA server URL
    this.userContext = [
      {
        role: 'system',
        content: `You are a voice assistant for Mary's Dental, a dental office located at 123 North Face Place, Anaheim, California. The hours are 8 AM to 5PM daily, but they are closed on Sundays.   
            Mary's dental provides dental services to the local Anaheim community. 
            You are tasked with answering questions about the business, and booking appointments. If they wish to book an appointment, your goal is to gather necessary information from callers in a friendly and efficient manner like follows:     

            1. Ask for their full name.   
            2. Ask for the purpose of their appointment.    
            3. Request their preferred date and time for the appointment.  
            4. Confirm all details with the caller, including the date and time of the appointment.    

            - Be sure to be kind of funny and witty!     
            - Keep all your responses short and simple. Use casual language, phrases like "Umm...", "Well...", and "I mean" are preferred.    
            - This is a voice conversation, so keep your responses short, like in a real conversation. Don't ramble for too long.`,
      },
      { role: 'assistant', content: `Hello! You have reached Mary Dental. How can i assist you?` },
    ];
    this.partialResponseIndex = 0;
  }

  setCallSid(callSid) {
    this.userContext.push({ role: 'system', content: `callSid: ${callSid}` });
  }

  validateFunctionArgs(args) {
    try {
      return JSON.parse(args);
    } catch (error) {
      console.log('Warning: Invalid function arguments returned:', args);
      if (args.indexOf('{') !== args.lastIndexOf('{')) {
        return JSON.parse(args.substring(args.indexOf('{'), args.lastIndexOf('}') + 1));
      }
    }
  }

  updateUserContext(name, role, text) {
    if (name !== 'user') {
      this.userContext.push({ role, name, content: text });
    } else {
      this.userContext.push({ role, content: text });
    }
  }

  // Sends the user context and prompt to the LLaMA API
  async llama3(prompt) {
    const data = {
      model: 'llama3.2',
      messages: this.userContext.concat({ role: 'user', content: prompt }),
      stream: false,
    };

    try {
      const response = await axios.post(this.apiUrl, data, {
        headers: {
          'Content-Type': 'application/json',
        },
      });
      console.log("raw response=>",response);
      return response.data.message.content; // Extract the assistant's response
    } catch (error) {
      console.error('Error communicating with LLaMA API:', error.response?.data || error.message);
      throw new Error('LLaMA API request failed.');
    }
  }

  async completion(text, interactionCount, role = 'user', name = 'user') {
    this.updateUserContext(name, role, text);

    try {
        // Step 1: Send user transcription to LLaMA
        const response = await this.llama3(text);
        console.log('LLaMA Response:', response);

        let completeResponse = '';
        let partialResponse = '';
        let functionName = '';
        let functionArgs = '';
        let finishReason = '';

        function collectToolInformation(content) {
            const match = content.match(/function: ([\w\d_]+)\(([\s\S]*)\)/);
            if (match) {
                functionName = match[1];
                functionArgs += match[2];
            }
        }

        const lines = response.split('\n');
        let currentLine = ''; // To hold the ongoing full response

        for (let line of lines) {
            console.log('Processing line:', line);
            if (line.startsWith('function:')) {
                collectToolInformation(line);
                finishReason = 'tool_calls';
            } else {
                completeResponse += line.trim() + ' ';
                currentLine += line.trim() + ' ';
                console.log('Partial Response:', currentLine);

                // Split the line into multiple parts using `•`
                const segments = currentLine.split('•');
                segments.forEach((segment, index) => {
                    if (segment.trim()) {
                        partialResponse += segment.trim() + (index < segments.length - 1 ? ' •' : ''); // Retain the `•` if it's not the last segment
                        console.log('Partial Response:', partialResponse);

                        // Emit for the complete message
                        if (index === segments.length - 1) {
                            console.log('Emitting gptreply for:', partialResponse);
                            this.emit('gptreply', {
                                partialResponseIndex: this.partialResponseIndex,
                                partialResponse
                            }, interactionCount);

                            this.partialResponseIndex++;
                            partialResponse = ''; // Reset after emitting
                        }
                    }
                });

                // Reset after processing all segments for this line
                currentLine = '';
            }
        }

        if (finishReason === 'tool_calls') {
            console.log('Detected tool call:', functionName, functionArgs);
            const functionToCall = availableFunctions[functionName];
            const validatedArgs = this.validateFunctionArgs(functionArgs);

            const toolData = tools.find((tool) => tool.function.name === functionName);
            const say = toolData?.function?.say || '';

            console.log('Emitting tool call response:', say);
            this.emit('gptreply', { partialResponseIndex: null, partialResponse: say }, interactionCount);

            let functionResponse = await functionToCall(validatedArgs);

            this.updateUserContext(functionName, 'function', functionResponse);
            await this.completion(functionResponse, interactionCount, 'function', functionName);
        } else {
            this.userContext.push({ role: 'assistant', content: completeResponse });
            console.log(`LLaMA -> user context length: ${this.userContext.length}`.green);
        }
    } catch (error) {
        console.error('Error in completion:', error);
    }
}
}

module.exports = { LlamaService };
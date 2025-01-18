const EventEmitter = require('events');
const axios = require('axios');
const tools = require('../functions/function-manifest');

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
      { role: 'assistant', content: `Hello! You have reached Mary Dental. How can I assist you?` },
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

  // Streaming implementation
  async llama3(prompt) {
    const data = {
      model: 'llama3.2',
      messages: this.userContext.concat({ role: 'user', content: prompt }),
      stream: true, // Enable streaming
    };

    return new Promise((resolve, reject) => {
      try {
        const response = axios.post(this.apiUrl, data, {
          headers: {
            'Content-Type': 'application/json',
          },
          responseType: 'stream', // Enable response streaming
        });

        let fullResponse = '';
        response.then((res) => {
          res.data.on('data', (chunk) => {
            const chunkString = chunk.toString();
            console.log('Received chunk:', chunkString);

            // Parse and process the streaming chunks
            try {
              const parsed = JSON.parse(chunkString);
              const delta = parsed.message.content || '';
              if (delta) {
                fullResponse += delta;

                // Emit partial responses for lower latency
                this.emit('partialReply', delta);
              }
            } catch (err) {
              console.error('Error parsing chunk:', err.message);
            }
          });

          res.data.on('end', () => {
            console.log('Streaming completed');
            resolve(fullResponse); // Resolve the full response when streaming ends
          });

          res.data.on('error', (err) => {
            console.error('Streaming error:', err.message);
            reject(err);
          });
        });
      } catch (err) {
        console.error('Error communicating with LLaMA API:', err.response?.data || err.message);
        reject(new Error('LLaMA API request failed.'));
      }
    });
  }

  async completion(text, interactionCount, role = 'user', name = 'user') {
    this.updateUserContext(name, role, text);

    try {
      const response = await this.llama3(text);

      // Process the full response after streaming
      console.log('Final LLaMA Response:', response);
      this.userContext.push({ role: 'assistant', content: response });
      this.emit('gptreply', { partialResponseIndex: this.partialResponseIndex, partialResponse: response }, interactionCount);
      this.partialResponseIndex++;
    } catch (error) {
      console.error('Error in completion:', error);
    }
  }
}

module.exports = { LlamaService };
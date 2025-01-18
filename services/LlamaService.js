const axios = require('axios'); // HTTP client for making API requests

class LlamaService {
  constructor(apiUrl) {
    this.apiUrl = apiUrl; // Base URL of your local LLaMA server
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
  }

  // Sends prompt and user context to the LLaMA API
  async llama3(prompt) {
    const data = {
      model: 'llama3',
      messages: this.userContext.concat({ role: 'user', content: prompt }),
      stream: false,
    };

    try {
      const response = await axios.post(this.apiUrl, data, {
        headers: {
          'Content-Type': 'application/json',
        },
      });

      return response.data.message.content; // Extract the assistant's response
    } catch (error) {
      console.error('Error communicating with LLaMA API:', error.response?.data || error.message);
      throw new Error('LLaMA API request failed.');
    }
  }

  // Adds a message to the context and gets a response
  async completion(prompt) {
    this.userContext.push({ role: 'user', content: prompt });
    const assistantResponse = await this.llama3(prompt);
    this.userContext.push({ role: 'assistant', content: assistantResponse });

    console.log(`Assistant: ${assistantResponse}`);
    return assistantResponse;
  }
}

module.exports = LlamaService;
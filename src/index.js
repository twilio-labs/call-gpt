#!/usr/bin/env node

require('dotenv').config();
require('colors');

const { TwilioServer } = require('./twilio/twilioServer');

/**
 * Main entry point for Twilio ↔ OpenAI Realtime Server
 * Direct speech-to-speech AI phone agent
 */

// Validate required environment variables
function validateEnv() {
  const required = ['OPENAI_API_KEY', 'SERVER'];
  const missing = required.filter(key => !process.env[key]);

  if (missing.length > 0) {
    console.error('❌ Missing required environment variables:'.red);
    missing.forEach(key => console.error(`   - ${key}`.red));
    console.error('\nPlease check your .env file'.yellow);
    process.exit(1);
  }

  console.log('✓ Environment variables validated'.green);
}

// Initialize and start server
async function main() {
  try {
    console.log('\n🚀 Starting Twilio ↔ OpenAI Realtime Server...\n'.cyan);

    // Validate environment
    validateEnv();

    // Create server instance
    const server = new TwilioServer({
      port: process.env.PORT || 3000,
      openaiApiKey: process.env.OPENAI_API_KEY,
      serverUrl: process.env.SERVER
    });

    // Start server
    await server.start();

    // Graceful shutdown handlers
    const shutdown = async (signal) => {
      console.log(`\n\n${signal} received`.yellow);
      await server.stop();
      process.exit(0);
    };

    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));

    // Handle uncaught errors
    process.on('uncaughtException', (error) => {
      console.error('Uncaught Exception:'.red, error);
      shutdown('UNCAUGHT_EXCEPTION');
    });

    process.on('unhandledRejection', (reason, promise) => {
      console.error('Unhandled Rejection at:'.red, promise, 'reason:', reason);
    });

  } catch (error) {
    console.error('Failed to start server:'.red, error);
    process.exit(1);
  }
}

// Run
main();

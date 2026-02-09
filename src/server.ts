import express from 'express';
import { TelegramBot } from './bot';
import { botConfigurations } from './bots';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

// Parse JSON bodies
app.use(express.json());

// Use modular bot configurations
const botConfigs = botConfigurations;

// Filter out bots without tokens
const validBotConfigs = botConfigs.filter(config => config.token);

if (validBotConfigs.length === 0) {
  throw new Error('No valid bot tokens found in environment variables');
}

// Initialize bots
const bots = validBotConfigs.map(config => new TelegramBot(config));

// Set up webhook endpoints for each bot
bots.forEach(bot => {
  const config = bot.getConfig();
  const webhookPath = `/${config.webhookPath}`;
  
  app.post(webhookPath, (req, res) => {
    try {
      // Verify webhook secret if provided
      if (config.secretToken) {
        const signature = req.headers['x-telegram-bot-api-secret-token'];
        if (signature !== config.secretToken) {
          console.warn(`[${config.name}] Invalid webhook signature`);
          return res.status(401).send('Unauthorized');
        }
      }

      // Handle the update
      bot.getBot().handleUpdate(req.body);
      res.status(200).send('OK');
    } catch (error) {
      console.error(`[${config.name}] Webhook error:`, error);
      res.status(500).send('Internal Server Error');
    }
  });

  console.log(`[${config.name}] Webhook endpoint: ${webhookPath}`);
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    bots: bots.map(bot => bot.getConfig().name)
  });
});

// Info endpoint
app.get('/info', (req, res) => {
  const baseUrl = process.env.WEBHOOK_BASE_URL || 'Not configured';
  
  res.status(200).json({
    framework: 'Express + TypeScript + Telegraf',
    totalBots: bots.length,
    bots: bots.map(bot => {
      const config = bot.getConfig();
      return {
        name: config.name,
        webhook: baseUrl ? `${baseUrl}/${config.webhookPath}` : 'Not set',
        hasSecretToken: !!config.secretToken,
        customCommands: config.customCommands?.map(cmd => ({
          command: cmd.command,
          description: cmd.description
        })) || []
      };
    })
  });
});

// Start the server and configure webhooks
app.listen(port, async () => {
  console.log(`🚀 Server is running on port ${port}`);
  console.log(`📊 Active bots: ${bots.length}`);
  
  // Display bot configurations
  bots.forEach(bot => {
    const config = bot.getConfig();
    console.log(`🤖 [${config.name}] Commands:`, config.customCommands?.map(cmd => `/${cmd.command}`).join(', ') || 'default only');
  });
  
  // Configure webhooks for each bot
  const webhookBaseUrl = process.env.WEBHOOK_BASE_URL;
  
  if (webhookBaseUrl) {
    for (const bot of bots) {
      const config = bot.getConfig();
      const webhookUrl = `${webhookBaseUrl}/${config.webhookPath}`;
      
      try {
        await bot.setWebhook(webhookUrl, config.secretToken);
        console.log(`✅ [${config.name}] Bot is running with webhooks`);
      } catch (error) {
        console.error(`❌ [${config.name}] Failed to set webhook:`, error);
        console.log(`🔄 [${config.name}] Falling back to polling mode`);
        bot.getBot().launch();
      }
    }
  } else {
    console.log('⚠️  No webhook base URL provided, running all bots in polling mode');
    bots.forEach(bot => {
      bot.getBot().launch();
    });
  }
});

// Graceful shutdown
process.once('SIGINT', () => {
  console.log('🛑 Shututting down bots...');
  bots.forEach(bot => bot.getBot().stop('SIGINT'));
  process.exit(0);
});

process.once('SIGTERM', () => {
  console.log('🛑 Shututting down bots...');
  bots.forEach(bot => bot.getBot().stop('SIGTERM'));
  process.exit(0);
});

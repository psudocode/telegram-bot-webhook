// Load environment variables first
import dotenv from 'dotenv';
dotenv.config();

// Export bot configurations for easy import
import { BotConfig } from '../bot';
import { menfessBotCommands, menfessStartHandler, menfessTextHandler, menfessCallbackHandler } from './menfess/commands';
import { promoteBotCommands, promoteStartHandler, promoteTextHandler } from './promote/commands';

export const botConfigurations: BotConfig[] = [
  {
    name: 'Menfess Bot',
    token: process.env.MENFESS_BOT_TOKEN || '',
    webhookPath: process.env.MENFESS_WEBHOOK_URI || 'menfess-webhook',
    secretToken: process.env.WEBHOOK_SECRET,
    customCommands: menfessBotCommands,
    startHandler: menfessStartHandler,
    textHandler: menfessTextHandler,
    callbackHandler: menfessCallbackHandler
  },
  {
    name: 'Promote Bot',
    token: process.env.PROMOTE_BOT_TOKEN || '',
    webhookPath: process.env.PROMOTE_WEBHOOK_URI || 'promote-webhook',
    secretToken: process.env.WEBHOOK_SECRET,
    customCommands: promoteBotCommands,
    startHandler: promoteStartHandler,
    textHandler: promoteTextHandler
  }
];

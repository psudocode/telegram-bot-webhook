import { Telegraf, Context } from 'telegraf';
import { message } from 'telegraf/filters';

export interface BotContext extends Context {}

export interface BotCommand {
  command: string;
  description: string;
  handler: (ctx: BotContext) => void | Promise<void>;
}

export interface BotConfig {
  name: string;
  token: string;
  webhookPath: string;
  secretToken?: string;
  customCommands?: BotCommand[];
  startHandler?: (ctx: BotContext) => void | Promise<void>;
  textHandler?: (ctx: BotContext) => void | Promise<void>;
  callbackHandler?: (ctx: BotContext) => void | Promise<void>;
  newChatMembersHandler?: (ctx: BotContext) => void | Promise<void>;
  leftChatMemberHandler?: (ctx: BotContext) => void | Promise<void>;
}

export class TelegramBot {
  private bot: Telegraf<BotContext>;
  private config: BotConfig;

  constructor(config: BotConfig) {
    this.config = config;
    this.bot = new Telegraf<BotContext>(config.token);
    this.setupHandlers();
  }

  private setupHandlers(): void {
    // Start command - use custom handler if provided, otherwise use default
    if (this.config.startHandler) {
      this.bot.start(this.config.startHandler);
    } else {
      this.bot.start((ctx) => {
        ctx.reply(`Welcome to ${this.config.name}! I am a Telegram bot powered by Telegraf and Express with webhooks.`);
      });
    }

    // Custom commands for this bot
    if (this.config.customCommands) {
      this.config.customCommands.forEach(cmd => {
        this.bot.command(cmd.command, cmd.handler);
      });
    }

    // Default help command - shows available commands for this bot
    this.bot.help((ctx) => {
      let helpText = `Available commands for ${this.config.name}:\n`;
      helpText += '/start - Start the bot\n';
      helpText += '/help - Show this help message\n';
      
      if (this.config.customCommands) {
        this.config.customCommands.forEach(cmd => {
          helpText += `/${cmd.command} - ${cmd.description}\n`;
        });
      }
      
      helpText += '/echo <message> - Echo your message';
      
      ctx.reply(helpText);
    });

    // Handle /echo command
    this.bot.command('echo', (ctx) => {
      if (!ctx.message || !('text' in ctx.message)) return;
      
      const message = ctx.message.text.split(' ').slice(1).join(' ');
      if (message) {
        ctx.reply(message);
      } else {
        ctx.reply('Please provide a message to echo. Usage: /echo <message>');
      }
    });

    // Handle text messages - use custom handler if provided
    if (this.config.textHandler) {
      this.bot.on(message('text'), this.config.textHandler);
    }

    // Handle callback queries - use custom handler if provided
    if (this.config.callbackHandler) {
      this.bot.on('callback_query', this.config.callbackHandler);
    }

    // Handle new chat members - use custom handler if provided
    if (this.config.newChatMembersHandler) {
      this.bot.on('new_chat_members', this.config.newChatMembersHandler);
    }

    // Handle left chat member - use custom handler if provided
    if (this.config.leftChatMemberHandler) {
      this.bot.on('left_chat_member', this.config.leftChatMemberHandler);
    }

    // Handle errors
    this.bot.catch((err, ctx) => {
      console.error(`Error for ${this.config.name} (${ctx.updateType}):`, err);
      ctx.reply('An error occurred while processing your request.');
    });
  }

  public getBot(): Telegraf<BotContext> {
    return this.bot;
  }

  public getConfig(): BotConfig {
    return this.config;
  }

  public addCustomCommand(command: BotCommand): void {
    this.bot.command(command.command, command.handler);
    
    // Add to config if not already there
    if (!this.config.customCommands) {
      this.config.customCommands = [];
    }
    this.config.customCommands.push(command);
  }

  public async setWebhook(webhookUrl: string, secretToken?: string): Promise<void> {
    try {
      await this.bot.telegram.setWebhook(webhookUrl, {
        secret_token: secretToken
      });
      console.log(`[${this.config.name}] Webhook set to: ${webhookUrl}`);
    } catch (error) {
      console.error(`[${this.config.name}] Failed to set webhook:`, error);
      throw error;
    }
  }

  public async deleteWebhook(): Promise<void> {
    try {
      await this.bot.telegram.deleteWebhook();
      console.log(`[${this.config.name}] Webhook deleted`);
    } catch (error) {
      console.error(`[${this.config.name}] Failed to delete webhook:`, error);
      throw error;
    }
  }
}

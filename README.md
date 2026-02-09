# Telegram Bot with Webhooks

A TypeScript Express.js application for creating Telegram bots using Telegraf with webhook support.

## Features

- 🤖 Telegram bot using Telegraf
- 🚀 Express.js server with TypeScript
- 🔗 Webhook support with optional secret token verification
- 🛡️ Error handling and graceful shutdown
- 🔧 Environment configuration
- 📝 TypeScript support with hot reload in development

## Prerequisites

- Node.js (v16 or higher)
- npm or yarn
- Telegram Bot Token (get from [@BotFather](https://t.me/botfather))

## Installation

1. Clone or create the project directory
2. Install dependencies:
   ```bash
   npm install
   ```

## Configuration

1. Copy the environment file:
   ```bash
   cp .env.example .env
   ```

2. Edit `.env` file with your configuration:
   ```env
   BOT_TOKEN=your_telegram_bot_token_here
   PORT=3000
   WEBHOOK_URL=https://your-domain.com/webhook
   WEBHOOK_SECRET=your_webhook_secret_here
   ```

## Development

Run in development mode with hot reload:
```bash
npm run dev
```

## Production

1. Build the project:
   ```bash
   npm run build
   ```

2. Start the server:
   ```bash
   npm start
   ```

## Bot Commands

- `/start` - Welcome message
- `/help` - Show available commands
- `/echo <message>` - Echo your message
- Any text message - Bot will echo back what you said

## Webhook Setup

For production deployment with webhooks:

1. Deploy your application to a server with HTTPS
2. Set the `WEBHOOK_URL` environment variable to your server's webhook endpoint
3. Optionally set `WEBHOOK_SECRET` for additional security
4. The bot will automatically configure webhooks on startup

## API Endpoints

- `POST /webhook` - Telegram webhook endpoint
- `GET /health` - Health check endpoint
- `GET /info` - Bot information endpoint

## Project Structure

```
src/
├── bot.ts      # Telegram bot implementation
├── server.ts   # Express server and webhook setup
└── dist/       # Compiled JavaScript (generated)
```

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `BOT_TOKEN` | Yes | Telegram bot token |
| `PORT` | No | Server port (default: 3000) |
| `WEBHOOK_URL` | No | Webhook URL for production |
| `WEBHOOK_SECRET` | No | Secret token for webhook verification |

## License

ISC

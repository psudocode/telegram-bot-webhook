# Environment Configuration Setup

This project supports multiple environment configurations for development and production.

## Environment Files

### 📁 `.env.development`
- Used for local development
- Contains development bot tokens and webhook URLs
- Includes debug settings
- **Do not commit to version control**

### 📁 `.env.production`
- Used for production deployment
- Contains production bot tokens and webhook URLs
- Optimized settings for production
- **Do not commit to version control**

### 📁 `.env.local`
- Optional local overrides
- Personal development settings
- **Do not commit to version control**

### 📁 `.env.example`
- Template file
- Shows all available environment variables
- **Safe to commit to version control**

## Usage

### Development Commands

```bash
# Development with default .env file
npm run dev

# Development with specific environment file
npm run dev:local

# Development with ngrok
npm run dev:ngrok
```

### Production Commands

```bash
# Build the project
npm run build

# Start production server
npm run start:prod

# Alternative production start
npm run start
```

## Environment Variables

### Required Variables
- `MENFESS_BOT_TOKEN` - Telegram bot token
- `MENFESS_WEBHOOK_BASE_URL` - Webhook base URL
- `MENFESS_WEBHOOK_URI` - Webhook endpoint path

### Optional Variables
- `WEBHOOK_SECRET` - Webhook verification secret
- `NODE_ENV` - Environment (development/production)
- `DEBUG` - Enable debug logging
- `LOG_LEVEL` - Logging level (debug/info/warn/error)

### Multiple Bots
- `SECOND_BOT_TOKEN` - Second bot token
- `SECOND_WEBHOOK_SECRET` - Second bot webhook secret

## Setup Instructions

### 1. Copy Environment Files
```bash
cp .env.example .env.development
cp .env.example .env.production
```

### 2. Configure Development
Edit `.env.development`:
```env
MENFESS_BOT_TOKEN=your_dev_bot_token
MENFESS_WEBHOOK_BASE_URL=https://your-ngrok-url.ngrok.io
```

### 3. Configure Production
Edit `.env.production`:
```env
MENFESS_BOT_TOKEN=your_prod_bot_token
MENFESS_WEBHOOK_BASE_URL=https://your-production-domain.com
```

### 4. Local Overrides (Optional)
Create `.env.local` for personal overrides:
```env
# Override webhook URL for testing
MENFESS_WEBHOOK_BASE_URL=https://my-test-ngrok.ngrok.io
```

## Priority Order

Environment variables are loaded in this order (later files override earlier ones):

1. `.env.development` or `.env.production` (based on NODE_ENV)
2. `.env.local` (local overrides)
3. Existing system environment variables

## Security Notes

- **Never commit actual bot tokens** to version control
- Use strong, unique webhook secrets
- Rotate tokens periodically
- Use different tokens for development and production
- Keep production secrets secure and separate

## Deployment

### Development
```bash
npm run dev:ngrok
```

### Production
```bash
npm run build
npm run start:prod
```

### Docker Deployment
Set environment variables in your Docker container or use docker-compose with environment files.

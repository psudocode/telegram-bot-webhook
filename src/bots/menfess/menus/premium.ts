import { BotContext } from '../../../bot';

// Simple premium menu keyboard
export const premiumMainKeyboard = {
    parse_mode: 'HTML' as const,
  reply_markup: {
    inline_keyboard: [
      [
        { text: '💎 Premium', callback_data: 'premium_buy' }
      ]
    ]
  }
};

// Simple premium menu message
export const premiumMainMenu = () => `
<b>💎 PREMIUM</b>

Upgrade to Premium for exclusive benefits:

<b>🌟 Premium Features:</b>
• 1000 character limit (vs 300 regular)
• 50 daily messages (vs 10 regular)
• Priority processing
• Custom themes & colors
• Priority support

Choose an option below to get started! ✨
`;

// Simple menu handler
export const handlePremiumMenu = async (ctx: BotContext, action: string): Promise<void> => {
  try {
    switch (action) {
      case 'premium_main':
        await ctx.editMessageText(premiumMainMenu(), premiumMainKeyboard);
        break;
        
      case 'premium_buy':
        await ctx.editMessageText(
          `<b>💎 BUY PREMIUM</b>\n\nChoose your plan:\n\n🌟 <b>Monthly - $4.99</b>\n💫 <b>Quarterly - $12.99</b>\n🔥 <b>Yearly - $39.99</b>\n\n🎁 <b>Free Trial - 7 days</b>\n\nPayment processing coming soon! 🔒`,
          {
            parse_mode: 'HTML',
            reply_markup: {
              inline_keyboard: [[
                { text: '🔙 Go Back', callback_data: 'premium_main' }
              ]]
            }
          }
        );
        break;
        
      case 'premium_back':
        await ctx.editMessageText(premiumMainMenu(), premiumMainKeyboard);
        break;
        
      default:
        try {
          await ctx.editMessageText('❌ Invalid option', {
            parse_mode: 'HTML',
            reply_markup: {
              inline_keyboard: [[
                { text: '🔙 Go Back', callback_data: 'premium_main' }
              ]]
            }
          });
        } catch (editError) {
          await ctx.reply('❌ Invalid option');
        }
    }
  } catch (error) {
    console.error('Premium menu error:', error);
    try {
      await ctx.editMessageText('❌ An error occurred. Please try again.', {
        parse_mode: 'HTML' as const,
        reply_markup: {
          inline_keyboard: [[
            { text: '🔙 Go Back', callback_data: 'premium_main' }
          ]]
        }
      });
    } catch (editError) {
      await ctx.reply('❌ An error occurred. Please try again.');
    }
  }
};

// Export premium menu components
export const premiumMenus = {
  keyboards: {
    main: premiumMainKeyboard
  },
  messages: {
    main: premiumMainMenu
  },
  handler: handlePremiumMenu
};
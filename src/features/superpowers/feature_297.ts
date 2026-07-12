import { BaseAgent } from '../../agents/BaseAgent';
import { botDb } from '../../db/botDb';
import * as fs from 'fs';
import * as path from 'path';

export interface FeatureContext {
    userId: number;
    projectPath?: string;
    chatContext?: any;
    arg?: string;
}

export const feature_297 = {
    id: 297,
    name: "⭐ وضع بناء البوتات Bot Builder",
    category: "المعالجات المعمارية المتقدمة",
    isStarred: true,
    async run(context: FeatureContext): Promise<string> {
        if (!context.projectPath) return "⚠️ لا يوجد مشروع نشط.";
        
        const botCode = `import { Telegraf } from 'telegraf';
import * as dotenv from 'dotenv';

dotenv.config();

const token = process.env.BOT_TOKEN;
if (!token) throw new Error("BOT_TOKEN is required");

const bot = new Telegraf(token);

bot.start((ctx) => ctx.reply("🌌 Welcome to your new OmniMind Bot!"));
bot.help((ctx) => ctx.reply("Send /ping to test."));
bot.command('ping', (ctx) => ctx.reply("🏓 Pong!"));

bot.launch().then(() => {
    console.log("🚀 Telegram Bot is now live and flying!");
});

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
`;
        try {
            fs.writeFileSync(path.join(context.projectPath, "src", "index.ts"), botCode);
            return `🤖 *تم بناء بوت تيليجرام كامل ونشط بنجاح!* 🤖
━━━━━━━━━━━━━━━━━━━━━━━━━
📍 الملف المصنوع: \`src/index.ts\`

✨ *محتوى كود البوت المبني:*
\`\`\`typescript
${botCode}
\`\`\`

💡 تم تثبيت هيكلية بوت تيليجرام Telegraf مع أوامر الترحيب ومصممة للتوسع المباشر. يمكنك البدء بتشغيله فوراً أو تعديله!ِ`;
        } catch (err: any) {
            return `❌ فشل بناء البوت: ${err.message}`;
        }
    }
};

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

export const feature_2 = {
    id: 2,
    name: "خزنة المفاتيح المشفرة",
    category: "التحكم والإعداد والربط",
    isStarred: false,
    async run(context: FeatureContext): Promise<string> {
        try {
            const rowGemini = await botDb.getCredential(context.userId, 'gemini');
            const rowOpenAI = await botDb.getCredential(context.userId, 'openai');
            const rowGithub = await botDb.getCredential(context.userId, 'github_token');
            
            return `🔒 *خزنة المفاتيح المشفرة لـ OmniMind* 🔒
━━━━━━━━━━━━━━━━━━━━━━━━━
يتم تخزين جميع مفاتيحك مشفرة باستخدام خوارزمية AES-256 مرتبطة بـ Telegram ID الخاص بك.

🔑 *حالة المفاتيح:*
• \`Gemini API Key\`: ${rowGemini ? "✅ مشفر ومحفوظ" : "❌ غير مضبوط (سيتم استخدام المفتاح الافتراضي للنظام)"}
• \`OpenAI API Key\`: ${rowOpenAI ? "✅ مشفر ومحفوظ" : "❌ غير مضبوط"}
• \`GitHub Token\`: ${rowGithub ? "✅ مشفر ومحفوظ" : "❌ غير مضبوط"}

💡 لتحديث أي مفتاح، استخدم الأمر:
\`/addkey [اسم_المزود] [المفتاح]\`
`;
        } catch (err: any) {
            return `❌ حدث خطأ أثناء تصفح الخزنة: ${err.message}`;
        }
    }
};

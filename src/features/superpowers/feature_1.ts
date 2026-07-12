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

export const feature_1 = {
    id: 1,
    name: "معالج الإعداد /setup",
    category: "التحكم والإعداد والربط",
    isStarred: false,
    async run(context: FeatureContext): Promise<string> {
        const activeProject = await botDb.getActiveProject(context.userId);
        const projectStatus = activeProject ? `🟢 المشروع النشط حالياً: *${activeProject.name}* (${activeProject.project_path})` : "🔴 لا يوجد مشروع نشط حالياً. يرجى البدء بإنشاء مشروع باستخدام /feature 16";
        return `🌌 *مرحباً بك في معالج الإعداد الذكي لـ OmniMind OS* 🌌
━━━━━━━━━━━━━━━━━━━━━━━━━
هذا البوت مهيأ بالكامل ومستعد لتطوير وبناء التطبيقات.

📊 *حالة النظام:*
• قاعدة البيانات: \`SQLite\` (جاهزة ونشطة)
• حوض التوكنات (Token Pool): نشط وتلقائي التدوير
${projectStatus}

🛠️ *الخطوات الأساسية للبدء:*
1. اضبط مفاتيح الـ AI الخاصة بك باستخدام:
   \`/addkey [openai|gemini|github_token] [المفتاح]\`
2. أنشئ مشروعاً جديداً باستخدام:
   \`/feature 16 [اسم_المشروع]\`
3. ابدأ في تعديل وتطوير الأكواد تلقائياً عن طريق مصفوفة الوكلاء الذكية!
`;
    }
};

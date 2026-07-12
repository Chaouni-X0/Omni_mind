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

export const feature_281 = {
    id: 281,
    name: "⭐ زر الذعر Panic Button",
    category: "الواجهة التفاعلية والأوامر الذكية",
    isStarred: true,
    async run(context: FeatureContext): Promise<string> {
        if (!context.projectPath) return "⚠️ لا يوجد مشروع نشط للتراجع فيه.";
        const backupFile = path.join(context.projectPath, "src", "index.ts.bak");
        const mainFile = path.join(context.projectPath, "src", "index.ts");
        
        try {
            if (fs.existsSync(backupFile)) {
                const backupCode = fs.readFileSync(backupFile, 'utf-8');
                fs.writeFileSync(mainFile, backupCode);
                return `🚨 *تم تفعيل زر الذعر واستعادة الكود السابق بنجاح!* 🚨
━━━━━━━━━━━━━━━━━━━━━━━━━
تم استرجاع الملف \`src/index.ts\` من النسخة الاحتياطية الأخيرة بأمان كامل وتفادي أي عطل مفاجئ!`;
            } else {
                // Let's create a backup now just in case
                if (fs.existsSync(mainFile)) {
                    fs.copyFileSync(mainFile, backupFile);
                    return `🔒 *تم أخذ لقطة حماية سريعة لمشروعك الآن!*
                     تم حفظ نسخة احتياطية من \`src/index.ts\` كمسار تراجع آمن في حال حدوث أي خطأ برميجي قادم.`;
                }
                return "⚠️ لم يتم العثور على أي كود أو نسخة احتياطية سابقة للقيام بعملية التراجع للوراء.";
            }
        } catch (err: any) {
            return `❌ فشل عملية الذعر: ${err.message}`;
        }
    }
};

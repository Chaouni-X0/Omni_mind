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

export const feature_300 = {
    id: 300,
    name: "⭐ تحليل الحمض النووي للكود",
    category: "المعالجات المعمارية المتقدمة",
    isStarred: true,
    async run(context: FeatureContext): Promise<string> {
        if (!context.projectPath) return "⚠️ لا يوجد مشروع نشط.";
        const indexTsPath = path.join(context.projectPath, "src", "index.ts");
        
        try {
            if (!fs.existsSync(indexTsPath)) {
                return "⚠️ ملف \`src/index.ts\` غير موجود بالمشروع النشط لإجراء تحليل الحمض النووي (DNA Analysis).";
            }
            
            const code = fs.readFileSync(indexTsPath, 'utf-8');
            const lines = code.split('\n');
            const lineCount = lines.length;
            const characters = code.length;
            const todoCount = (code.match(/TODO|todo/g) || []).length;
            const evalCount = (code.match(/eval\(/g) || []).length;
            
            // Check for some potential architectural issues
            const hasCORS = code.includes("cors");
            const hasRateLimit = code.includes("rateLimit") || code.includes("rate-limit");
            
            return `🧬 *تقرير تحليل الحمض النووي البرمجي (DNA Code Analysis)* 🧬
━━━━━━━━━━━━━━━━━━━━━━━━━
📊 *إحصائيات الملف الرئيسي:*
• عدد أسطر الكود: \`${lineCount}\` سطر
• عدد الأحرف الإجمالي: \`${characters}\` حرف
• مهمات مؤجلة (TODOs): \`${todoCount}\`

🔒 *الصحة والأمان:*
• استخدام \`eval\` المحظور: \`${evalCount === 0 ? "🟢 0 (ممتاز وآمن)" : "🔴 " + evalCount + " (خطر أمني كبير!)"}\`
• حماية CORS للطلبات الخارجية: \`${hasCORS ? "🟢 متوفرة ومطبقة" : "🟡 غير مطبقة (يفضل إضافتها)"}\`
• قيود معدل الاستهلاك (Rate Limit): \`${hasRateLimit ? "🟢 مفعلة ومضبوطة" : "🟡 غير متوفرة (ينصح بها لتفادي الـ DDOS)"}\`

💡 *التقييم العام لبنية الكود:* ${lineCount < 100 ? "⭐ بنية بسيطة ومحكمة" : lineCount < 400 ? "⭐⭐ بنية ناضجة وسليمة" : "⚠️ كود طويل جداً يحتاج للتقسيم لوحدات فرعية (Modularization)"}`;
        } catch (err: any) {
            return `❌ فشل تحليل الكود: ${err.message}`;
        }
    }
};

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

export const feature_37 = {
    id: 37,
    name: "وكيل المبرمج",
    category: "مصفوفة الوكلاء الذكية",
    isStarred: false,
    async run(context: FeatureContext): Promise<string> {
        if (!context.projectPath) {
            return "⚠️ الرجاء تحديد مشروع نشط أولاً عن طريق إنشاء مشروع (/feature 16 [الاسم])";
        }
        if (!context.arg) {
            return "💡 يرجى كتابة التعديل أو الميزة المطلوبة بعد الأمر. مثال: `/feature 37 أضف دالة لحساب عمر المستخدم وإظهارها`";
        }
        
        const agent = new BaseAgent();
        const codeContext = fs.existsSync(path.join(context.projectPath, "src", "index.ts")) 
            ? fs.readFileSync(path.join(context.projectPath, "src", "index.ts"), 'utf-8')
            : "";
            
        const prompt = `أنت "وكيل المبرمج" الذكي في OmniMind OS.
        مهمتك هي كتابة أو تعديل الكود في المشروع النشط بناءً على رغبة المستخدم الحالية:
        "${context.arg}"
        
        يرجى قراءة الكود الحالي وكتابة الكود الجديد المناسب المكمل له لإنتاج تطبيق كامل.
        اكتب الكود الجديد بالكامل داخل كتلة نصية \`\`\`typescript [الكود] \`\`\` وسأقوم بكتابته تلقائياً على الملف.`;
        
        const res = await agent.run(prompt, codeContext, context.userId, undefined, context.projectPath);
        
        // Extract typescript code block
        const match = res.content.match(/```typescript([\s\S]*?)```/);
        if (match && match[1]) {
            const codeToWrite = match[1].trim();
            const filePath = path.join(context.projectPath, "src", "index.ts");
            fs.writeFileSync(filePath, codeToWrite);
            return `💻 *تم معالجة وتحديث الكود بنجاح بواسطة وكيل المبرمج!* 💻
━━━━━━━━━━━━━━━━━━━━━━━━━
📍 الملف المعدل: \`src/index.ts\`

✨ *الكود الجديد المكتوب:*
\`\`\`typescript
${codeToWrite}
\`\`\`

✅ تم الحفظ التلقائي في المشروع النشط!`;
        }
        
        return res.content;
    }
};

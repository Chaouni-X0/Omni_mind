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

export const feature_75 = {
    id: 75,
    name: "تعديل ملف محدد",
    category: "أدوات معالجة الملفات والكود",
    isStarred: false,
    async run(context: FeatureContext): Promise<string> {
        if (!context.projectPath) return "⚠️ لا يوجد مشروع نشط.";
        if (!context.arg) return "💡 يرجى إدخال اسم الملف والمحتوى الجديد أو التوجيه. مثال: `/feature 75 src/index.ts : أضف ميزة جديدة`";
        
        const parts = context.arg.split(":");
        const relativeFilePath = parts[0]?.trim();
        const editInstruction = parts[1]?.trim();
        
        if (!relativeFilePath || !editInstruction) {
            return "⚠️ صيغة غير صحيحة. يرجى استخدام: `/feature 75 [مسار_الملف] : [التعليمات]`";
        }
        
        const targetFile = path.join(context.projectPath, relativeFilePath);
        if (!fs.existsSync(targetFile)) {
            return `❌ الملف ` + relativeFilePath + ` غير موجود بالمشروع.`;
        }
        
        const currentCode = fs.readFileSync(targetFile, 'utf-8');
        const agent = new BaseAgent();
        const prompt = `أنت مهندس برمجيات محترف ومسؤول عن ميزة تعديل الملفات.
        الملف الحالي هو: ${relativeFilePath}
        المحتوى الحالي:
        ${currentCode}
        
        التعديل المطلوب: "${editInstruction}"
        
        يرجى كتابة الكود المعدل بالكامل والنهائي للملف داخل كتلة نصية \`\`\`text [الكود] \`\`\` ليتم استبدال كامل محتويات الملف بها.`;
        
        const res = await agent.run(prompt, currentCode, context.userId, undefined, context.projectPath);
        
        const match = res.content.match(/```(text|typescript|javascript|json)?([\s\S]*?)```/);
        if (match && match[2]) {
            const newCode = match[2].trim();
            fs.writeFileSync(targetFile, newCode);
            return `📝 *تم تعديل الملف بنجاح!* 📝
━━━━━━━━━━━━━━━━━━━━━━━━━
📂 الملف: \`${relativeFilePath}\`

✅ تم تطبيق التعديل وحفظ الكود بنجاح!`;
        }
        
        return res.content;
    }
};

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

export const feature_76 = {
    id: 76,
    name: "إنشاء ملف جديد",
    category: "أدوات معالجة الملفات والكود",
    isStarred: false,
    async run(context: FeatureContext): Promise<string> {
        if (!context.projectPath) return "⚠️ لا يوجد مشروع نشط.";
        if (!context.arg) return "💡 يرجى إدخال اسم الملف والكود. مثال: `/feature 76 src/utils.ts : function hello() { return 'hi'; }`";
        
        const parts = context.arg.split(":");
        const relativeFilePath = parts[0]?.trim();
        const fileContent = parts.slice(1).join(":").trim();
        
        if (!relativeFilePath) {
            return "⚠️ صيغة غير صحيحة. يرجى استخدام: `/feature 76 [مسار_الملف] : [محتوى الكود]`";
        }
        
        const targetFile = path.join(context.projectPath, relativeFilePath);
        try {
            const dir = path.dirname(targetFile);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
            
            // If content is empty, let AI generate it
            let finalContent = fileContent;
            if (!finalContent) {
                const agent = new BaseAgent();
                const res = await agent.run(`قم بتوليد كود أولي مفيد لملف يسمى "${relativeFilePath}"`, "", context.userId);
                const match = res.content.match(/```([\s\S]*?)```/);
                finalContent = (match && match[1]) ? match[1].trim() : res.content;
            }
            
            fs.writeFileSync(targetFile, finalContent);
            return `✨ *تم إنشاء الملف الجديد بنجاح!* ✨
━━━━━━━━━━━━━━━━━━━━━━━━━
📂 مسار الملف: \`${relativeFilePath}\`
📏 الحجم: ${finalContent.length} حرف

✅ تم الحفظ بنجاح وجاهز للاستخدام في تطبيقك!`;
        } catch (err: any) {
            return `❌ فشل إنشاء الملف: ${err.message}`;
        }
    }
};

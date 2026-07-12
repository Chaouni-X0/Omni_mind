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

export const feature_17 = {
    id: 17,
    name: "التبدل بين المشاريع /switch",
    category: "إدارة المشاريع والبيئات",
    isStarred: false,
    async run(context: FeatureContext): Promise<string> {
        try {
            const active = await botDb.getActiveProject(context.userId);
            if (!context.arg) {
                return `📁 *المشروع الحالي النشط:* ${active ? '*' + active.name + '* (' + active.project_path + ')' : "❌ لا يوجد مشروع نشط"}.
                
💡 لتغيير المشروع النشط، قم بتفعيل الميزة مع إدخال المسار أو الاسم:
\`/feature 17 [اسم_المشروع]\``;
            }
            
            const cleanName = context.arg.replace(/[^a-zA-Z0-9_-]/g, "");
            const targetPath = path.join(process.cwd(), "projects", cleanName);
            if (!fs.existsSync(targetPath)) {
                return `❌ المجلد غير موجود في المسار: ` + targetPath;
            }
            
            await botDb.createProject(context.userId, cleanName, targetPath);
            return `✅ تم تبديل المشروع النشط بنجاح إلى: *${cleanName}*`;
        } catch (err: any) {
            return `❌ فشل تبديل المشروع: ${err.message}`;
        }
    }
};

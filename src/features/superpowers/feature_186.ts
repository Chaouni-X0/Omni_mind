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

export const feature_186 = {
    id: 186,
    name: "توليد ملفات Dockerfile",
    category: "حاويات دوكر وأتمتة خطوط الإمداد",
    isStarred: false,
    async run(context: FeatureContext): Promise<string> {
        if (!context.projectPath) return "⚠️ لا يوجد مشروع نشط.";
        
        const dockerfileContent = `FROM node:20-alpine
WORKDIR /usr/src/app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build || true
EXPOSE 3000
CMD ["npm", "start"]`;
        
        try {
            fs.writeFileSync(path.join(context.projectPath, "Dockerfile"), dockerfileContent);
            return `🐳 *مستكشف دوكر - تم توليد Dockerfile بنجاح!* 🐳
━━━━━━━━━━━━━━━━━━━━━━━━━
تم حفظ الملف في جذر مشروعك النشط:

\`\`\`dockerfile
${dockerfileContent}
\`\`\`
✅ تم التصدير بنجاح!`;
        } catch (err: any) {
            return `❌ فشل توليد Dockerfile: ${err.message}`;
        }
    }
};

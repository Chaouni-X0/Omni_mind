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

export const feature_187 = {
    id: 187,
    name: "توليد docker-compose",
    category: "حاويات دوكر وأتمتة خطوط الإمداد",
    isStarred: false,
    async run(context: FeatureContext): Promise<string> {
        if (!context.projectPath) return "⚠️ لا يوجد مشروع نشط.";
        
        const composeContent = `version: '3.8'
services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
    restart: always`;
        
        try {
            fs.writeFileSync(path.join(context.projectPath, "docker-compose.yml"), composeContent);
            return `🐳 *مستكشف دوكر - تم توليد docker-compose.yml بنجاح!* 🐳
━━━━━━━━━━━━━━━━━━━━━━━━━
تم حفظ الملف في جذر مشروعك النشط:

\`\`\`yaml
${composeContent}
\`\`\`
✅ تم التصدير بنجاح!`;
        } catch (err: any) {
            return `❌ فشل توليد docker-compose.yml: ${err.message}`;
        }
    }
};

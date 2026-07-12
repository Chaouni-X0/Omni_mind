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

export const feature_296 = {
    id: 296,
    name: "⭐ مولد المخطط الشامل Blueprint",
    category: "المعالجات المعمارية المتقدمة",
    isStarred: true,
    async run(context: FeatureContext): Promise<string> {
        if (!context.projectPath) return "⚠️ لا يوجد مشروع نشط.";
        const indexTsPath = path.join(context.projectPath, "src", "index.ts");
        const packageJsonPath = path.join(context.projectPath, "package.json");
        
        let blueprint = `🏛️ *مخطط البنية المعمارية للمشروع (Architectural Blueprint)* 🏛️
━━━━━━━━━━━━━━━━━━━━━━━━━
📍 مسار المشروع: \`${context.projectPath}\`

📁 *المكونات المكتشفة بالبنية:*
`;
        
        if (fs.existsSync(packageJsonPath)) {
            const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
            blueprint += `• الحزم المستهدفة: ` + Object.keys(pkg.dependencies || {}).join(", ") + `\n`;
        }
        if (fs.existsSync(indexTsPath)) {
            const code = fs.readFileSync(indexTsPath, 'utf-8');
            const lines = code.split('\n').length;
            blueprint += `• ملف الدخول الرئيسي (` + lines + ` سطر): \`src/index.ts\`\n`;
            
            const functions = code.match(/function\s+(\w+)|const\s+(\w+)\s*=\s*\(/g) || [];
            if (functions.length > 0) {
                blueprint += `• الدوال المعمارية الرئيسية المكتشفة:\n` + functions.map(f => "   - " + f.replace(/function|const|=/g, "").trim() + "()").join("\n") + "\n";
            }
        } else {
            blueprint += "• المشروع فارغ وبحاجة لتوليد الكود الرئيسي.\n";
        }
        
        blueprint += `\n📊 *خطة البناء المقترحة (الـ 5 مراحل):*
1. مرحلة التأسيس وضبط الاعتماديات ومحركات قواعد البيانات.
2. مرحلة معالجة وتدفق البيانات وبناء الـ Schemas.
3. مرحلة بناء المنطق البرمجي والـ Controllers والـ Services.
4. مرحلة تأمين الاتصالات والـ Rate Limiting والـ API Gateway.
5. مرحلة الاختبار ونشر الحاويات وضمان عدم التوقف.`;
        
        return blueprint;
    }
};

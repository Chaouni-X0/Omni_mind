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

export const feature_298 = {
    id: 298,
    name: "⭐ مهندس الـ APIs التلقائي",
    category: "المعالجات المعمارية المتقدمة",
    isStarred: true,
    async run(context: FeatureContext): Promise<string> {
        if (!context.projectPath) return "⚠️ لا يوجد مشروع نشط.";
        
        const apiCode = `import express from 'express';
const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;

// database simulation
let items: any[] = [];

// REST API Routes
app.get('/api/items', (req, res) => {
    res.json({ success: true, data: items });
});

app.post('/api/items', (req, res) => {
    const item = { id: items.length + 1, name: req.body.name, createdAt: new Date() };
    items.push(item);
    res.status(201).json({ success: true, data: item });
});

app.delete('/api/items/:id', (req, res) => {
    const id = parseInt(req.params.id, 10);
    items = items.filter(i => i.id !== id);
    res.json({ success: true, message: "Item deleted successfully" });
});

app.listen(PORT, () => {
    console.log("🚀 REST API is running and listening on port " + PORT);
});
`;
        try {
            fs.writeFileSync(path.join(context.projectPath, "src", "index.ts"), apiCode);
            // Ensure express is added in project package.json dependencies
            const packagePath = path.join(context.projectPath, "package.json");
            if (fs.existsSync(packagePath)) {
                const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf-8'));
                pkg.dependencies = pkg.dependencies || {};
                pkg.dependencies["express"] = "^4.19.0";
                pkg.devDependencies = pkg.devDependencies || {};
                pkg.devDependencies["@types/express"] = "^4.17.21";
                fs.writeFileSync(packagePath, JSON.stringify(pkg, null, 2));
            }
            
            return `⚡ *مهندس الـ APIs التلقائي لـ OmniMind* ⚡
━━━━━━━━━━━━━━━━━━━━━━━━━
📂 تم توليد واجهة برمجة تطبيقات REST متكاملة في \`src/index.ts\`!

✨ *كود الـ API المكتوب:*
\`\`\`typescript
${apiCode}
\`\`\`

✅ تم تسجيل \`express\` و \`@types/express\` في اعتماديات المشروع. يمكنك البدء في تجربة الـ API وتوسيعها!`;
        } catch (err: any) {
            return `❌ فشل إنشاء الـ API: ${err.message}`;
        }
    }
};

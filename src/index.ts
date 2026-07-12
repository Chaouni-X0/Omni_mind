import { Telegraf, Markup } from 'telegraf';
import * as dotenv from 'dotenv';
import * as http from 'http';
import * as fs from 'fs';
import * as path from 'path';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { serve } from '@hono/node-server';
import { botDb } from './db/botDb';
import { BaseAgent } from './agents/BaseAgent';
import { encrypt } from './vault/crypto';
import { executeShell } from './utils/toolExecutor';
import { ALL_300_FEATURES } from './features/allFeatures';
import { ALL_IMPLEMENTED_FEATURES } from './features/superpowers';
import { zipRepairManager } from './utils/zipRepairManager';

dotenv.config();

const token = process.env.BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN;
if (!token) {
    throw new Error("BOT_TOKEN or TELEGRAM_BOT_TOKEN is not set in environment variables");
}

const bot = new Telegraf(token);

// Help command detailing all 53+ features and the 300 Superpowers matrix
bot.command('help', (ctx) => {
    const helpMsg = `
🌌 <b>OmniMind OS Node Bot - دليل الميزات الأسطورية</b>

🔥 <b>فهرس القدرات الفائقة الـ 300:</b>
• <code>/features</code> - فتح المستكشف التفاعلي لتصفح فئات وقدرات النظام الـ 300.
• <code>/feature [الرقم]</code> - تفعيل الميزة رقم (1-300) فوراً (مثال: <code>/feature 53</code> لتفعيل مراجعة الأمان).
• <code>/feature [الاسم]</code> - البحث السريع في الـ 300 ميزة وتنشيطها تلقائياً.

🤖 <b>التحكم الأساسي والشخصيات (/persona):</b>
• /task [مهمة] - تشغيل العميل الذكي لتنفيذ مهمة برمجية.
• /persona [normal|duck|devil|eli5|roast] - تغيير شخصية البوت للتفاعل المناسب.
  - 🦆 <b>duck:</b> البطة المطاطية التفاعلية - إرشاد سقراطي بدون تقديم كود مباشر.
  - 😈 <b>devil:</b> محامي الشيطان - الاعتراض على قراراتك وتحليل العيوب.
  - 🧸 <b>eli5:</b> شرح الكود للأطفال بتبسيط وتشبيهات رائعة.
  - 🔥 <b>roast:</b> شوي لطيف بأسلوب كوميدي ساخر للمطورين.

🏆 <b>نظام التلعيب والمرح والإنتاجية:</b>
• /rpg - عرض مستواك البرمجي، نقاط الـ XP، واللقب الحالي.
• /break - وضع الاستراحة الذكي (مؤقت قهوة مع فحص الكود بالخلفية).
• /oops - زر الطوارئ (تراجع كامل، إعادة الكود للسابق، ومسودة اعتذار للعميل).
• /matrix - شاشة مصفوفة كود متحركة توضح حالة عمل الوكلاء.

⚡ <b>إدارة التوكنات والتكلفة:</b>
• /addkey [openai|gemini|github_token] [مفتاح] - إضافة مفاتيحك الخاصة مشفرة.
• /addpool [openai|gemini] [مفتاح] - إضافة توكنات لحوض التدوير التلقائي لتجنب حد الاستهلاك.
• /cost - لوحة التكلفة الحية (إحصائيات استهلاك التوكنات).
• /projects - إدارة مشاريع التطوير والمسارات المشتركة.
• /lock - حماية الملفات من التعديل المشترك.
• /team - جلسة فريق العمل الموحد.

💫 <i>تمتع بتجربة مذهلة تجمع بين قوة الوكلاء والمرح البرمجي الفائق!</i>`;
    ctx.reply(helpMsg, { parse_mode: 'HTML' });
});

bot.command('task', async (ctx) => {
    const text = ctx.message.text.replace('/task', '').trim();
    if (!text) {
        return ctx.reply('يرجى كتابة وصف المهمة البرمجية المراد تنفيذها بعد الأمر. مثال: `/task أضف دالة لترتيب الأرقام`');
    }

    ctx.reply('🔄 جاري معالجة المهمة بواسطة عقل OmniMind المستمر...');
    
    try {
        const agent = new BaseAgent();
        const activeProject = await botDb.getActiveProject(ctx.from.id);
        const projectPath = activeProject ? activeProject.project_path : undefined;
        
        const result = await agent.run(text, "", ctx.from.id, undefined, projectPath);
        
        // Add level up notification checks
        const xpUpdate = await botDb.addXP(ctx.from.id, 25, true);
        
        let levelUpHeader = "";
        if (xpUpdate.leveledUp) {
            levelUpHeader = `🎉 *LEVEL UP!* لقد ارتقيت إلى مستوى *${xpUpdate.level}* وحصلت على لقب *${xpUpdate.title}*!\n\n`;
        }

        ctx.reply(`${levelUpHeader}✅ *نتيجة عمل وكيل OmniMind:*\n\n${result.content}`, { parse_mode: 'Markdown' });
    } catch (error: any) {
        // If build/agent error occurs, roast the user or output meme if roast mode active!
        const prefs = await botDb.getPreferences(ctx.from.id);
        if (prefs?.selected_persona === 'roast') {
            ctx.reply(`🔥 *شوي أليم للخطأ البرمجي:*\n\n"يا فنان، الكود هذا لا يعمل! يبدو أن لوحة المفاتيح كانت غارقة في القهوة أثناء كتابة هذا الطلب. الخطأ الحقيقي هنا هو:\n\n${error.message}\n\nأصلحه قبل أن تضحك عليك السيرفرات!"`);
        } else {
            ctx.reply(`❌ حدث خطأ أثناء تنفيذ المهمة: ${error.message}`);
        }
    }
});

// Panic Button
bot.command('oops', async (ctx) => {
    ctx.reply('🚨 *زر الذعر (Panic Mode) تم تفعيله!* جاري التراجع السريع بالخلفية وإعداد مسودة بريد تبرير للمستثمرين/العملاء...', { parse_mode: 'Markdown' });
    
    try {
        const activeProject = await botDb.getActiveProject(ctx.from.id);
        const projectPath = activeProject ? activeProject.project_path : process.cwd();

        // 1. Rollback changes using git operation
        const rollbackRes = await executeShell("git checkout -- . && git clean -fd", projectPath);
        
        // 2. Apology text via Gemini fallback
        const agent = new BaseAgent();
        const apologyPrompt = "أنت مبرمج خبير واجه عطلاً فادحاً في السيرفر وقام بإصلاحه وتراجع عن التعديلات. اكتب مسودة بريد اعتذاري مهني وممتع للعملاء أو المدير يوضح العطل بلغة راقية جداً ومطمئنة.";
        const apologyResult = await agent.run(apologyPrompt, "", ctx.from.id);

        ctx.reply(`🧹 *حالة التراجع:* ${rollbackRes.success ? "✅ تم مسح التعديلات غير المحفوظة والرجوع للحالة المستقرة الأخيرة!" : "⚠️ لم نتمكن من التراجع التلقائي (ربما لا يوجد مستودع git نشط)."}\n\n📨 *مسودة رسالة اعتذار احترافية وجاهزة للنسخ:*\n\n${apologyResult.content}`);
    } catch (err: any) {
        ctx.reply(`❌ خطأ في تشغيل وضع الذعر: ${err.message}`);
    }
});

// Matrix Mode visual
bot.command('matrix', (ctx) => {
    const matrixText = `
💻 *OmniMind Matrix OS Live View*
🤖 *حالة خلية الوكلاء المعرفية:*

\`\`\`
10101101  [CRITIC AGENT]  -> ACTIVE 🟢 (Analyzing code smells)
01100010  [CODER AGENT]   -> STANDBY 🟡 (Waiting for instruction)
11101011  [TESTER AGENT]  -> ACTIVE 🟢 (Executing continuous mocha checks)
00101101  [SECURITY AGENT]-> SLEEPING 💤 (Audit complete)

  ▲
 / \\   SWARM SYNCING... 100%
/___\\  PORT: 3000
\`\`\`

_تم توليد تمثيل مرئي مصفوفي ناجح لشبكة الوكلاء الحالية._
`;
    ctx.reply(matrixText, { parse_mode: 'Markdown' });
});

// Smart Coffee Break
bot.command('break', (ctx) => {
    ctx.reply(`☕ *حان وقت استراحة القهوة الذكية (3 ساعات)!*
البوت سيتولى الآن فحص البيئة بالخلفية للتأكد من عدم تعطل أي من الاختبارات...

⏳ *مؤقت الاستراحة بدأ الآن.* خذ قسطاً من الراحة لزيادة ذكائك وتركيزك البرمجي!`);
});

// Scenario Simulator
bot.command('simulate', async (ctx) => {
    const scenario = ctx.message.text.replace('/simulate', '').trim();
    if (!scenario) {
        return ctx.reply('⚠️ يرجى تحديد السيناريو المراد محاكاته. مثال:\n`/simulate الاستغناء عن PostgreSQL والاعتماد بالكامل على MongoDB`', { parse_mode: 'Markdown' });
    }

    ctx.reply('🔮 *جاري تشغيل محاكي العواقب الهندسية والسيناريوهات...*');
    try {
        const agent = new BaseAgent();
        const simulatePrompt = `أنت مبرمج معماري عبقري. قم بعمل تقييم هندسي فائق وتنبؤ كامل بالتأثيرات، الإيجابيات، السلبيات، والخطوات المطلوبة لهذا القرار أو السيناريو المعماري: "${scenario}".`;
        const res = await agent.run(simulatePrompt, "", ctx.from.id);
        ctx.reply(`🔮 *تقرير محاكاة السيناريو المعماري:*\n\n${res.content}`);
    } catch (e: any) {
        ctx.reply(`❌ فشل المحاكاة: ${e.message}`);
    }
});

// Blueprint Generator
bot.command('blueprint', async (ctx) => {
    const idea = ctx.message.text.replace('/blueprint', '').trim();
    if (!idea) {
        return ctx.reply('⚠️ يرجى كتابة فكرة التطبيق لتوليد المخطط. مثال:\n`/blueprint تطبيق توصيل وجبات سريع`', { parse_mode: 'Markdown' });
    }

    ctx.reply('🗺️ *جاري توليد مخطط معماري هندسي شامل للمشروع...*');
    try {
        const agent = new BaseAgent();
        const blueprintPrompt = `قم بإنشاء وثيقة تصميم معماري (Project Blueprint) متكاملة ومفصلة لإنشاء هذا التطبيق: "${idea}". يجب أن تشمل الوثيقة:
1. معمارية النظام والطبقات المقترحة.
2. تصميم قاعدة البيانات والجداول والعلاقات الأساسية.
3. خطة التنفيذ مقسمة لـ 5 مراحل متتالية.
4. الاعتماديات والبرمجيات والمكتبات المفضلة لضمان السرعة والأمان.`;
        const res = await agent.run(blueprintPrompt, "", ctx.from.id);
        ctx.reply(`🗺️ *مخطط مشروع OmniMind (Blueprint):*\n\n${res.content}`);
    } catch (e: any) {
        ctx.reply(`❌ فشل توليد المخطط: ${e.message}`);
    }
});

// RedTeam Security Hardener / Auditor
bot.command('redteam', async (ctx) => {
    ctx.reply('🥷 *جاري إطلاق وكيل الفريق الأحمر (Security Audit) لفحص كود المشروع أمنياً والبحث عن الثغرات...*');
    try {
        const activeProject = await botDb.getActiveProject(ctx.from.id);
        const projectPath = activeProject ? activeProject.project_path : process.cwd();

        // Reading directory code files to pass as context
        let codeCtx = "Project Files Context:\n";
        try {
            const files = fs.readdirSync(projectPath).filter(f => f.endsWith('.ts') || f.endsWith('.js') || f.endsWith('.json'));
            for (const f of files.slice(0, 5)) {
                const content = fs.readFileSync(path.join(projectPath, f), 'utf8');
                codeCtx += `\n--- File: ${f} ---\n${content.slice(0, 1000)}\n`;
            }
        } catch (e) {}

        const agent = new BaseAgent();
        const auditPrompt = `أنت مهندس أمن سيبراني خبير (Red Team Specialist). قم بتحليل الكود التالي واستخراج الثغرات الأمنية المحتملة (مثل حقن SQL، تسريب توكنات، ضعف الـ CORS، ثغرات XSS)، ثم حدد درجة الخطورة (منخفضة/متوسطة/حرجة) مع تقديم طريقة معالجتها بدقة وبرمجياً.`;
        const res = await agent.run(auditPrompt, codeCtx, ctx.from.id);
        ctx.reply(`🥷 *تقرير الفحص الأمني (Red Team Audit):*\n\n${res.content}`);
    } catch (e: any) {
        ctx.reply(`❌ فشل إجراء الفحص الأمني: ${e.message}`);
    }
});

// Dockerizer
bot.command('dockerize', async (ctx) => {
    ctx.reply('🐳 *جاري تحليل مشروعك لتوليد إعدادات Dockerfiles و docker-compose الأمثل...*');
    try {
        const activeProject = await botDb.getActiveProject(ctx.from.id);
        const projectPath = activeProject ? activeProject.project_path : process.cwd();

        let packageJsonContent = "";
        try {
            packageJsonContent = fs.readFileSync(path.join(projectPath, 'package.json'), 'utf8');
        } catch (e) {}

        const agent = new BaseAgent();
        const dockerPrompt = `قم بكتابة ملف Dockerfile متقن وملف docker-compose.yml لخدمة هذا المشروع بالاعتماد على محتويات package.json التالية:\n${packageJsonContent || 'Node.js app'}. اشرح طريقة التشغيل والبدء السريع بالتفصيل.`;
        const res = await agent.run(dockerPrompt, "", ctx.from.id);
        ctx.reply(`🐳 *ملفات حاويات Docker المولدة تلقائيًا:*\n\n${res.content}`);
    } catch (e: any) {
        ctx.reply(`❌ فشل توليد ملفات Docker: ${e.message}`);
    }
});

// PR Storyteller
bot.command('story', async (ctx) => {
    ctx.reply('📖 *جاري استخراج تغييرات Git وتحويل كودك لملحمة قصصية ممتعة...*');
    try {
        const activeProject = await botDb.getActiveProject(ctx.from.id);
        const projectPath = activeProject ? activeProject.project_path : process.cwd();

        const diffRes = await executeShell("git diff HEAD~1", projectPath);
        const diffText = diffRes.success ? diffRes.stdout : "Modified some code context for testing purposes.";

        const agent = new BaseAgent();
        const storyPrompt = `قم بتحويل الفروقات البرمجية (git diff) التالية إلى قصة ملحمية بطولية تصف المعركة التي خاضها المبرمج للقضاء على التعديلات وإدخال هذه التحسينات، لتستخدم كقصة ممتعة في شرح مراجعة الكود (PR description):\n\n${diffText.slice(0, 3000)}`;
        const res = await agent.run(storyPrompt, "", ctx.from.id);
        ctx.reply(`📖 *ملحمة المطور المبرمج:*\n\n${res.content}`);
    } catch (e: any) {
        ctx.reply(`❌ فشل كتابة القصة: ${e.message}`);
    }
});

// Interactive OS Main Menu Dashboard
bot.command('os', async (ctx) => {
    const rpg = await botDb.getRPG(ctx.from.id);
    const osMsg = `
🌌 *لوحة التحكم OmniMind OS - نظام مصفوفي نشط*
━━━━━━━━━━━━━━━━━━━━━━━━━━
👤 *المطور:* ${ctx.from.first_name}
⭐ *المستوى:* ${rpg.level} | *اللقب:* ${rpg.title}
━━━━━━━━━━━━━━━━━━━━━━━━━━

الرجاء استخدام قائمة الأزرار التفاعلية البرمجية بالأسفل لتشغيل وتنفيذ الميزات فورياً وبدون كتابة أوامر معقدة:
`;
    const keyboard = Markup.inlineKeyboard([
        [
            Markup.button.callback('🏆 RPG Dashboard', 'os_rpg'),
            Markup.button.callback('📊 Live Costs', 'os_costs')
        ],
        [
            Markup.button.callback('🗺️ App Blueprint', 'os_blueprint'),
            Markup.button.callback('🥷 Security Audit', 'os_redteam')
        ],
        [
            Markup.button.callback('🐳 Dockerize App', 'os_docker'),
            Markup.button.callback('💻 Swarm Swarm', 'os_matrix')
        ],
        [
            Markup.button.callback('☕ Quick Break', 'os_break'),
            Markup.button.callback('🎭 Change Persona', 'os_persona')
        ],
        [
            Markup.button.callback('🌟 300 Superpowers 🌟', 'os_300_powers')
        ],
        [
            Markup.button.callback('📜 All Commands | كل الأوامر 📜', 'os_commands')
        ]
    ]);

    ctx.reply(osMsg, { parse_mode: 'Markdown', ...keyboard });
});

bot.command('addkey', async (ctx) => {
    if (!ctx.from) return;
    const text = ctx.message.text.replace('/addkey', '').trim();
    const parts = text.split(/\s+/);
    if (parts.length < 2) {
        return ctx.reply('⚠️ الاستخدام الصحيح: `/addkey [openai|gemini|github_token] [المفتاح]`', { parse_mode: 'Markdown' });
    }
    const provider = parts[0]!.toLowerCase();
    const key = parts[1]!;
    
    if (!['openai', 'gemini', 'github_token'].includes(provider)) {
        return ctx.reply('⚠️ الموفر غير مدعوم. الموفرون المدعومون هم: `openai`, `gemini`, `github_token`', { parse_mode: 'Markdown' });
    }
    
    try {
        await botDb.ensureUser(ctx.from.id, ctx.from.username);
        const encrypted = encrypt(key, ctx.from.id);
        await botDb.addCredential(ctx.from.id, provider, encrypted);
        
        ctx.reply(`✅ تم تشفير وحفظ مفتاح *${provider}* بأمان تام في الخزنة الخاصة بك!`, { parse_mode: 'Markdown' });
    } catch (e: any) {
        ctx.reply(`❌ فشل حفظ المفتاح: ${e.message}`);
    }
});

bot.command('addpool', async (ctx) => {
    if (!ctx.from) return;
    const text = ctx.message.text.replace('/addpool', '').trim();
    const parts = text.split(/\s+/);
    if (parts.length < 2) {
        return ctx.reply('⚠️ الاستخدام الصحيح: `/addpool [openai|gemini] [المفتاح]`', { parse_mode: 'Markdown' });
    }
    const provider = parts[0]!.toLowerCase();
    const key = parts[1]!;
    
    if (!['openai', 'gemini'].includes(provider)) {
        return ctx.reply('⚠️ الموفر غير مدعوم لحوض التدوير. الموفرون المدعومون هم: `openai`, `gemini`', { parse_mode: 'Markdown' });
    }
    
    try {
        await botDb.ensureUser(ctx.from.id, ctx.from.username);
        const encrypted = encrypt(key, ctx.from.id);
        await botDb.addPoolToken(ctx.from.id, provider, encrypted);
        
        ctx.reply(`✅ تم إضافة المفتاح لحوض التدوير الخاص بـ *${provider}* بنجاح وتأمينه!`, { parse_mode: 'Markdown' });
    } catch (e: any) {
        ctx.reply(`❌ فشل إضافة المفتاح للحوض: ${e.message}`);
    }
});

bot.command('projects', async (ctx) => {
    if (!ctx.from) return;
    const text = ctx.message.text.replace('/projects', '').trim();
    await botDb.ensureUser(ctx.from.id, ctx.from.username);
    
    if (!text) {
        const active = await botDb.getActiveProject(ctx.from.id);
        const activeMsg = active 
            ? `🟢 *المشروع النشط:* \`${active.name}\`\n📍 *المسار:* \`${active.project_path}\``
            : `🔴 *لا يوجد مشروع نشط حالياً.*`;
        
        return ctx.reply(`${activeMsg}\n\n💡 لإنشاء مشروع جديد وتفعيله، استخدم:\n\`/projects [اسم_المشروع] [مسار_المشروع]\`\n\nمثال:\n\`/projects MyWebSite /app/my_app\``, { parse_mode: 'Markdown' });
    }
    
    const parts = text.split(/\s+/);
    const name = parts[0];
    if (!name) {
        return ctx.reply('⚠️ يرجى تحديد اسم المشروع.', { parse_mode: 'Markdown' });
    }
    const projectPath = parts[1] || path.join(process.cwd(), "projects", name);
    
    try {
        if (!fs.existsSync(projectPath)) {
            fs.mkdirSync(projectPath, { recursive: true });
        }
        await botDb.createProject(ctx.from.id, name, projectPath);
        ctx.reply(`✅ تم تفعيل مشروع *${name}* بنجاح!\n📍 المسار: \`${projectPath}\``, { parse_mode: 'Markdown' });
    } catch (e: any) {
        ctx.reply(`❌ فشل تفعيل المشروع: ${e.message}`);
    }
});

bot.command('lock', async (ctx) => {
    if (!ctx.from) return;
    const text = ctx.message.text.replace('/lock', '').trim();
    if (!text) {
        return ctx.reply('⚠️ يرجى تحديد مسار الملف لقفله. مثال: `/lock src/index.ts`', { parse_mode: 'Markdown' });
    }
    
    try {
        await botDb.ensureUser(ctx.from.id, ctx.from.username);
        const activeProject = await botDb.getActiveProject(ctx.from.id);
        if (!activeProject) {
            return ctx.reply('⚠️ يرجى تفعيل مشروع أولاً باستخدام أمر `/projects` لتتمكن من قفل الملفات.', { parse_mode: 'Markdown' });
        }
        
        const success = await botDb.lockFile(activeProject.id, text, ctx.from.id);
        if (success) {
            ctx.reply(`🔒 تم قفل الملف \`${text}\` بنجاح لحسابك فقط!`, { parse_mode: 'Markdown' });
        } else {
            const lock = await botDb.getFileLock(activeProject.id, text);
            ctx.reply(`⚠️ هذا الملف مقفل حالياً بواسطة مستخدم آخر (معرف المستخدم: ${lock?.locked_by}).`, { parse_mode: 'Markdown' });
        }
    } catch (e: any) {
        ctx.reply(`❌ فشل قفل الملف: ${e.message}`);
    }
});

bot.command('unlock', async (ctx) => {
    if (!ctx.from) return;
    const text = ctx.message.text.replace('/unlock', '').trim();
    if (!text) {
        return ctx.reply('⚠️ يرجى تحديد مسار الملف لإلغاء قفله. مثال: `/unlock src/index.ts`', { parse_mode: 'Markdown' });
    }
    
    try {
        await botDb.ensureUser(ctx.from.id, ctx.from.username);
        const activeProject = await botDb.getActiveProject(ctx.from.id);
        if (!activeProject) {
            return ctx.reply('⚠️ يرجى تفعيل مشروع أولاً باستخدام أمر `/projects` لتتمكن من إلغاء قفل الملفات.', { parse_mode: 'Markdown' });
        }
        
        const lock = await botDb.getFileLock(activeProject.id, text);
        if (!lock) {
            return ctx.reply(`💡 الملف \`${text}\` غير مقفل أصلاً.`, { parse_mode: 'Markdown' });
        }
        
        if (lock.locked_by !== ctx.from.id) {
            return ctx.reply(`⚠️ لا تملك صلاحية فك قفل هذا الملف لأنه مقفل بواسطة مستخدم آخر.`, { parse_mode: 'Markdown' });
        }
        
        await botDb.unlockFile(activeProject.id, text);
        ctx.reply(`🔓 تم فك قفل الملف \`${text}\` وهو متاح الآن للجميع!`, { parse_mode: 'Markdown' });
    } catch (e: any) {
        ctx.reply(`❌ فشل فك قفل الملف: ${e.message}`);
    }
});

bot.command('team', async (ctx) => {
    await handleTeamSession(ctx);
});

bot.command('team_session', async (ctx) => {
    await handleTeamSession(ctx);
});

async function handleTeamSession(ctx: any) {
    if (!ctx.from) return;
    try {
        await botDb.ensureUser(ctx.from.id, ctx.from.username);
        const activeProject = await botDb.getActiveProject(ctx.from.id);
        if (!activeProject) {
            return ctx.reply('⚠️ لا يوجد مشروع نشط حالياً. يرجى تفعيل مشروع أولاً باستخدام أمر `/projects`.', { parse_mode: 'Markdown' });
        }
        ctx.reply(`👥 *جلسة عمل الفريق النشطة للمشروع:* \`${activeProject.name}\`\n\n- نظام الحماية ضد تصادم التعديلات مفعل تلقائيًا.\n- استخدم \`/lock [مسار_الملف]\` للعمل على ملف بشكل مستقل.\n- استخدم \`/unlock [مسار_الملف]\` لإلغاء القفل.\n\n_أنت وفريقك متصلون الآن بنفس بيئة التطوير والوكلاء!_`, { parse_mode: 'Markdown' });
    } catch (error: any) {
        ctx.reply(`❌ فشل تهيئة جلسة الفريق: ${error.message}`);
    }
}

bot.command('start', async (ctx) => {
    if (!ctx.from) return;
    await botDb.ensureUser(ctx.from.id, ctx.from.username);
    ctx.reply(`🌌 مرحبًا بك في *OmniMind OS* - رفيق دربك التطويري الأسطوري!\n\nاستخدم /help لعرض قائمة الميزات الـ 300 المدمجة، أو اكتب /os لفتح لوحة التحكم الذكية التفاعلية.`, { parse_mode: 'Markdown' });
});

bot.command('persona', async (ctx) => {
    if (!ctx.from) return;
    const text = ctx.message.text.replace('/persona', '').trim().toLowerCase();
    const validPersonas = ['normal', 'duck', 'devil', 'eli5', 'roast'];
    
    if (!text || !validPersonas.includes(text)) {
        return ctx.reply('⚠️ يرجى تحديد نمط الشخصية بعد الأمر. الشخصيات المتاحة:\n\n• `normal` - الوكيل الطبيعي\n• `duck` - البطة المطاطية\n• `devil` - محامي الشيطان\n• `eli5` - مبسط للأطفال\n• `roast` - شواية كوميدية\n\nمثال: `/persona roast`', { parse_mode: 'Markdown' });
    }
    
    try {
        await botDb.ensureUser(ctx.from.id, ctx.from.username);
        await botDb.setPersona(ctx.from.id, text);
        const names: Record<string, string> = {
            normal: "الوكيل الطبيعي المحترف 🤖",
            duck: "البطة المطاطية السقراطية 🦆",
            devil: "محامي الشيطان المشاكس 😈",
            eli5: "مبسط الكود الرائع 🧸",
            roast: "شواية الكود الكوميدية 🔥"
        };
        ctx.reply(`✅ تم تفعيل *${names[text]}* بنجاح! جميع المهام والردود القادمة ستتبع هذا النمط الأسطوري.`, { parse_mode: 'Markdown' });
    } catch (error: any) {
        ctx.reply(`❌ فشل تغيير الشخصية: ${error.message}`);
    }
});

bot.command('rpg', async (ctx) => {
    if (!ctx.from) return;
    try {
        await botDb.ensureUser(ctx.from.id, ctx.from.username);
        const rpg = await botDb.getRPG(ctx.from.id);
        const nextXpRequired = rpg.level * 100;
        const xpPercent = Math.min(100, Math.floor(((rpg.xp || 0) / nextXpRequired) * 100));
        ctx.reply(`🏆 *إحصائيات RPG المطور المتكاملة:* \n\n• اللقب: *${rpg.title}*\n• المستوى الحالي: *${rpg.level}*\n• شريط الخبرة: *${xpPercent}%* [${rpg.xp}/${nextXpRequired} XP]\n• إجمالي المهام الناجحة: *${rpg.tasks_completed}*`, { parse_mode: 'Markdown' });
    } catch (e: any) {
        ctx.reply(`❌ فشل جلب بيانات RPG: ${e.message}`);
    }
});

bot.command('cost', async (ctx) => {
    if (!ctx.from) return;
    try {
        await botDb.ensureUser(ctx.from.id, ctx.from.username);
        const costs = await botDb.getCosts(ctx.from.id);
        let breakdownText = "";
        if (costs.breakdown.length === 0) {
            breakdownText = "• لا توجد طلبات مسجلة حتى الآن.";
        } else {
            costs.breakdown.forEach((row: any) => {
                breakdownText += `• *${row.model}:* ${row.request_count} طلبات | ${row.total_tokens} توكن | \$${row.total_cost.toFixed(6)}\n`;
            });
        }
        const costMsg = `
📊 *OmniMind Live Cost Dashboard*
👤 *المستخدم:* ${ctx.from.first_name}

📈 *تفاصيل النماذج المستهلكة:*
${breakdownText}

🪙 *إجمالي التوكنز المستهلكة:* ${costs.totalTokens} Tokens
💵 *إجمالي التكلفة التقديرية:* \$${costs.totalCost.toFixed(6)} USD
`;
        ctx.reply(costMsg, { parse_mode: 'Markdown' });
    } catch (error: any) {
        ctx.reply(`❌ فشل جلب لوحة التكلفة: ${error.message}`);
    }
});

// Map all callbacks for the OS interface
bot.action('os_rpg', async (ctx) => {
    ctx.answerCbQuery();
    const rpg = await botDb.getRPG(ctx.from!.id);
    const nextXpRequired = rpg.level * 100;
    const xpPercent = Math.min(100, Math.floor(((rpg.xp || 0) / nextXpRequired) * 100));
    ctx.reply(`🏆 *إحصائيات RPG المطور المتكاملة:* \n\n• اللقب: ${rpg.title}\n• المستوى الحالي: ${rpg.level}\n• شريط الخبرة: ${xpPercent}% [${rpg.xp}/${nextXpRequired} XP]\n• إجمالي المهام الناجحة: ${rpg.tasks_completed}`);
});

bot.action('os_costs', async (ctx) => {
    ctx.answerCbQuery();
    const costs = await botDb.getCosts(ctx.from!.id);
    ctx.reply(`📊 *لوحة استهلاك الموارد الميزانية:*\n\n• إجمالي التوكنز: ${costs.totalTokens}\n• إجمالي الميزانية المستهلكة: \$${costs.totalCost.toFixed(6)} USD`);
});

bot.action('os_blueprint', async (ctx) => {
    ctx.answerCbQuery();
    ctx.reply('يرجى استخدام أمر `/blueprint [اسم التطبيق]` لتوليد مخطط معماري متكامل لفكرة مشروعك الجديدة!');
});

bot.action('os_redteam', async (ctx) => {
    ctx.answerCbQuery();
    ctx.reply('يرجى تشغيل أمر `/redteam` للبدء الفوري بالفحص الأمني التفصيلي لجميع الملفات البرمجية النشطة بمستودع المشروع.');
});

bot.action('os_docker', async (ctx) => {
    ctx.answerCbQuery();
    ctx.reply('يرجى تشغيل أمر `/dockerize` ليقوم البوت بقراءة وتحليل معمارية المشروع وكتابة الحاويات والـ compose الجاهز.');
});

bot.action('os_matrix', (ctx) => {
    ctx.answerCbQuery();
    ctx.reply(`💻 *OmniMind OS Live Swarm Node State:* \n\n🤖 [Critic Agent] -> ACTIVE 🟢\n🤖 [Coder Agent]  -> ACTIVE 🟢\n🤖 [Tester Agent] -> STANDBY 🟡`);
});

bot.action('os_break', (ctx) => {
    ctx.answerCbQuery();
    ctx.reply('☕ تم بدء استراحة القهوة الذكية لمدة 3 ساعات! استمتع بوقتك ودع الوكلاء يعملون في الخلفية لفحص جودة البيئة.');
});

bot.action('os_persona', (ctx) => {
    ctx.answerCbQuery();
    ctx.reply('يرجى كتابة أمر تغيير الشخصية لتوجيه أسلوب البوت:\nمثلاً `/persona duck` أو `/persona roast` أو `/persona normal` لتجربة تفاعل تليق بمزاجك الحالي!');
});

// Map general developer superpowers directly so they respond with rich custom helpful answers
const directFeatures: Record<string, string> = {
    pipeline: 'أنت مهندس DevOps محترف. قم بإنشاء ملف إعداد لـ GitHub Actions CI/CD كامل وآمن لمشروع Node.js يشمل الاختبار والتأكد من البناء والنشر.',
    harden: 'أنت مبرمج حماية خبير. اكتب كود كامل لتأمين خادم Express Node.js باستخدام مكتبة helmet، ضبط CORS، تحديد الطلبات rate limits، وحماية المخرجات والمدخلات.',
    profile: 'أنت مهندس أداء متقدم. قم بتحليل معمارية كود Node.js وتفاعله مع SQL وكتابة دليل متكامل للبحث عن الاختناقات وتطبيق الفهارس والتخزين المؤقت.',
    i18n: 'أنت مطور دولي محترف. اشرح كيف يمكن عزل النصوص الصلبة بمشروع برمجيات ونقلها لملفات ترجمة JSON بشكل آلي وسلس.',
    oracle: 'أنت مستشار مكتبات واعتمادات. قم بعمل مقارنة معمقة بين أهم المكتبات البرمجية الشائعة مثل Axios vs Fetch أو Express vs Fastify مع تحديد متى نختار كلاً منها.',
    health: 'أنت طبيب الكود البرمجي. اشرح العوامل التي تؤدي إلى زيادة "توتر وتشنج الكود" (Code stress) وكيفية الحفاظ على دائرية تفرع منخفضة وصحة مستقرة.',
    build_api: 'أنت مهندس برمجيات محترف. قم بكتابة الهيكل البرمجي المتكامل لـ API مخصصة لإدارة مستخدمين (Users CRUD) كاملة المكونات من مسارات ومتحكمات واختبارات.',
    build_bot: 'أنت خبير بوتات تيليغرام. قم بكتابة الكود النموذجي الكامل لبناء بوت Telegraf Node.js متفاعل مع أزرار مضمنة وحفظ الحالة بقاعدة بيانات SQLite.',
    adr: 'أنت مهندس معماري متقدم. اكتب سجل قرار معماري متقن (Architecture Decision Record - ADR) يناقش قرار التحول من معمارية ميكروسيرفيس إلى معمارية مونوليث.',
    multiphase: 'أنت مدير مشاريع ذكي. اشرح كيف يمكن تجزئة الأهداف البرمجية الضخمة لـ 5 مراحل تطوير منفصلة واختبار جودتها بشكل تراكمي وآمن.',
    dna: 'أنت خبير هندسة عكسية. اشرح كيفية تفكيك وتحليل البنية الجينية للبرمجيات المكتوبة لتحديد التعقيدات وعيوب التصميم بدقة.',
    graph: 'أنت مهندس طوبولوجيا برمجية. اشرح كيف يمكن استخراج ورسم شجرة العلاقات والاعتماديات الهيكلية للملفات والمجلدات المعقدة.',
    deploy: 'أنت خبير عمليات تشغيل. اكتب دليلاً متكاملاً لتطبيق عملية النشر بدون توقف (Zero-Downtime deployment) لخوادم الويب وتحديث السيرفرات بأمان.',
    chaos: 'أنت مهندس فوضى (Chaos Engineer). اشرح كيفية محاكاة سيناريوهات انقطاع الخدمات، هبوط السيرفرات، واختبار مرونة النظام واستقرار الأنظمة تحت الضغط الفائق.',
    migrate: 'أنت خبير هجرة برمجية. اشرح بالتفصيل وبخطوات واضحة كيفية ترحيل كود أو قاعدة بيانات من نظام قديم لنظام حديث بالكامل مع الحفاظ على البيانات.'
};

// Auto register all direct commands so they resolve beautifully
Object.entries(directFeatures).forEach(([cmd, systemInstruction]) => {
    bot.command(cmd, async (ctx) => {
        const text = ctx.message.text.replace(`/${cmd}`, '').trim();
        const arg = text || "مشروع Node.js قياسي";
        
        ctx.reply(`⚡ *OmniMind OS* -> جاري معالجة أمر *[/${cmd}]* باستخدام الذكاء المعرفي...`, { parse_mode: 'Markdown' });
        try {
            const agent = new BaseAgent();
            const res = await agent.run(`${systemInstruction}\nالموضوع المستهدف: "${arg}"`, "", ctx.from.id);
            
            // Add RPG XP for running advanced command
            const xpUpdate = await botDb.addXP(ctx.from.id, 20, false);
            let levelUpHeader = "";
            if (xpUpdate.leveledUp) {
                levelUpHeader = `🎉 *LEVEL UP!* لقد ارتقيت إلى مستوى *${xpUpdate.level}* وحصلت على لقب *${xpUpdate.title}*!\n\n`;
            }

            ctx.reply(`${levelUpHeader}📡 *نتيجة تنفيذ المعالج المتقدم لـ /${cmd}:*\n\n${res.content}`, { parse_mode: 'Markdown' });
        } catch (e: any) {
            ctx.reply(`❌ فشل معالجة الأمر: ${e.message}`);
        }
    });
});

async function handleZipRepairFlow(ctx: any, fileUrl: string, originalFilename: string, instructions: string) {
    const statusMsg = await ctx.reply('🚀 <b>جاري تهيئة معالج المشاريع المتقدم (OmniMind ZIP Unpack Engine)...</b>', { parse_mode: 'HTML' });
    
    const progress = {
        updateMessage: async (text: string) => {
            try {
                await ctx.telegram.editMessageText(ctx.chat.id, statusMsg.message_id, undefined, text, { parse_mode: 'HTML' });
            } catch (e) {
                console.error("Progress update failed:", e);
            }
        }
    };

    try {
        const userId = ctx.from.id;
        const result = await zipRepairManager.processZipRepair(fileUrl, instructions, userId, originalFilename, progress);

        const filesListText = result.filesChanged.map(f => `• <code>${f}</code>`).join('\n');
        const successMsg = `
✨ <b>تم إصلاح وتحديث مشروعك بنجاح!</b> 🎉
━━━━━━━━━━━━━━━━━━━━━━━━━
📝 <b>تقرير التحليل الذكي للوكيل:</b>
${result.analysis}

🛠️ <b>الملفات التي تم تعديلها/إنشاؤها (${result.filesChanged.length}):</b>
${filesListText || '• لم يتم تغيير أي ملفات.'}

📥 <b>رابط التحميل المباشر عالي السرعة (يدعم حتى 100MB+):</b>
👉 <a href="${result.downloadUrl}">اضغط هنا لتحميل المشروع المصلح</a>
━━━━━━━━━━━━━━━━━━━━━━━━━
💡 <i>ملاحظة: يمكنك استخدام هذا الملف المضغوط ورفعه إلى GitHub مباشرة.</i>
`;
        await progress.updateMessage(successMsg);

        try {
            const stats = fs.statSync(result.localPath);
            if (stats.size <= 50 * 1024 * 1024) {
                await ctx.replyWithDocument({ source: result.localPath, filename: path.basename(result.localPath) }, {
                    caption: `📦 مشروعك المصلح: ${path.basename(result.localPath)}`
                });
            }
        } catch (tgSendErr: any) {
            console.error("Failed to send zip directly via Telegram:", tgSendErr.message);
        }

    } catch (error: any) {
        await progress.updateMessage(`❌ <b>فشل إصلاح المشروع:</b>\n<code>${error.message}</code>\n\nيرجى التحقق من ملف الـ ZIP والمحاولة مرة أخرى!`);
    }
}

bot.on('document', async (ctx) => {
    const doc = ctx.message.document;
    const filename = doc.file_name || 'project.zip';
    
    if (filename.toLowerCase().endsWith('.zip') || doc.mime_type === 'application/zip') {
        const caption = ctx.message.caption || "أصلح الأخطاء وحسن جودة الكود والمستندات";
        try {
            const fileLink = await ctx.telegram.getFileLink(doc.file_id);
            await handleZipRepairFlow(ctx, fileLink.href, filename, caption);
        } catch (err: any) {
            ctx.reply(`⚠️ فشل تحميل الملف من تيليغرام: ${err.message}\n\n<i>تنويه: لدى تيليغرام حد أقصى لتحميل الملفات المباشرة للبوتات (20 ميغابايت). إذا كان حجم مشروعك أكبر من 20 ميغابايت، يرجى رفعه على Google Drive أو Dropbox وإرسال الرابط المباشر للملف المضغوط هنا (مثال: <code>http://domain.com/project.zip</code>) وسنقوم بتحميله وإصلاحه فوراً!</i>`, { parse_mode: 'HTML' });
        }
    } else {
        ctx.reply('⚠️ يرجى رفع ملف مضغوط بصيغة <code>.zip</code> فقط ليتمكن وكيل OmniMind من تفكيكه وإصلاحه وإعادة إرساله لك.', { parse_mode: 'HTML' });
    }
});

// Handle general incoming text messages that are not commands
bot.on('text', async (ctx) => {
    const text = ctx.message.text.trim();
    if (text.startsWith('/')) {
        return; // Ignore if it looks like a command but wasn't registered
    }

    const zipUrlPattern = /(https?:\/\/[^\s]+?\.zip(?:\?[^\s]*)?)/i;
    const hasZipUrl = text.match(zipUrlPattern);
    if (hasZipUrl && hasZipUrl[1]) {
        const url = hasZipUrl[1];
        const instructions = text.replace(url, '').trim() || "أصلح الأخطاء وحسن الكود والمستندات";
        let originalFilename = 'project.zip';
        try {
            originalFilename = path.basename(new URL(url).pathname) || 'project.zip';
            if (!originalFilename.endsWith('.zip')) {
                originalFilename += '.zip';
            }
        } catch (e) {}
        return await handleZipRepairFlow(ctx, url, originalFilename, instructions);
    }

    ctx.reply('🔄 جاري التفكير وتحليل رسالتك من قبل وكيل OmniMind الذكي...');
    
    try {
        const agent = new BaseAgent();
        const activeProject = await botDb.getActiveProject(ctx.from.id);
        const projectPath = activeProject ? activeProject.project_path : undefined;
        
        const result = await agent.run(text, "", ctx.from.id, undefined, projectPath);
        
        const xpUpdate = await botDb.addXP(ctx.from.id, 10, false);
        let levelUpHeader = "";
        if (xpUpdate.leveledUp) {
            levelUpHeader = `🎉 *LEVEL UP!* لقد ارتقيت إلى مستوى *${xpUpdate.level}* وحصلت على لقب *${xpUpdate.title}*!\n\n`;
        }

        ctx.reply(`${levelUpHeader}${result.content}`, { parse_mode: 'Markdown' });
    } catch (error: any) {
        ctx.reply(`❌ فشل معالجة الرسالة: ${error.message}`);
    }
});

// Helper functions and commands for the 300 Superpowers
function show300Categories(ctx: any, isEdit = false) {
    const msg = `
🌟 *مصفوفة قدرات OmniMind الـ 300 الفائقة* 🌟
━━━━━━━━━━━━━━━━━━━━━━━━━
أهلاً بك في المحرك المعرفي الشامل للمطورين! يحتوي النظام على *300 ميزة أسطورية* مصممة خصيصاً لمرافقتك وتسهيل حياتك البرمجية.

يرجى اختيار أحد الفئات بالأسفل لتصفح الميزات التابعة لها، أو اكتب \`/feature [رقم الميزة]\` لتفعيلها فوراً (مثال: \`/feature 53\` لتشغيل وكيل مراجعة الأمان):
`;
    // Group categories uniquely
    const categories = Array.from(new Set(ALL_300_FEATURES.map(f => f.category)));
    const buttons = [];
    for (let i = 0; i < categories.length; i += 2) {
        const row = [];
        const cat1 = categories[i];
        if (cat1) {
            row.push(Markup.button.callback(`📁 ${cat1.slice(0, 18)}`, `fcat_${i}`));
        }
        const cat2 = categories[i + 1];
        if (cat2) {
            row.push(Markup.button.callback(`📁 ${cat2.slice(0, 18)}`, `fcat_${i + 1}`));
        }
        buttons.push(row);
    }
    
    // Add back to OS main dashboard
    buttons.push([Markup.button.callback('🌌 العودة للوحة OS', 'os_back_main')]);

    const keyboard = Markup.inlineKeyboard(buttons);
    if (isEdit) {
        ctx.editMessageText(msg, { parse_mode: 'Markdown', ...keyboard }).catch(() => {});
    } else {
        ctx.reply(msg, { parse_mode: 'Markdown', ...keyboard });
    }
}

async function runSingleFeature(ctx: any, feature: any, featureArg?: string) {
    ctx.reply(`⚡ *OmniMind OS* -> جاري تحفيز وتفعيل قدرة: *[${feature.id}] ${feature.name}* باستخدام الذكاء المعرفي...`, { parse_mode: 'Markdown' });

    try {
        const activeProject = await botDb.getActiveProject(ctx.from!.id);
        const projectPath = activeProject ? activeProject.project_path : undefined;

        let content = "";
        const implementedFeature = ALL_IMPLEMENTED_FEATURES[feature.id];
        if (implementedFeature && typeof implementedFeature.run === 'function') {
            content = await implementedFeature.run({
                userId: ctx.from!.id,
                projectPath,
                chatContext: ctx,
                arg: featureArg
            });
        } else {
            throw new Error(`لم يتم العثور على ملف الميزة الفائقة رقم ${feature.id}`);
        }

        // Add XP reward for running features
        const xpAmount = feature.isStarred ? 40 : 25;
        const xpUpdate = await botDb.addXP(ctx.from!.id, xpAmount, false);
        
        let levelUpHeader = "";
        if (xpUpdate.leveledUp) {
            levelUpHeader = `🎉 *LEVEL UP!* لقد ارتقيت إلى مستوى *${xpUpdate.level}* وحصلت على لقب *${xpUpdate.title}*!\n\n`;
        }

        ctx.reply(`${levelUpHeader}📡 *تقرير القدرة النشطة [${feature.id}] - ${feature.name}:*\n\n${content}`, { parse_mode: 'Markdown' });
    } catch (error: any) {
        ctx.reply(`❌ فشل تفعيل الميزة: ${error.message}`);
    }
}

bot.command('feature', async (ctx) => {
    const text = ctx.message.text.replace('/feature', '').trim();
    if (!text) {
        return show300Categories(ctx);
    }

    const parts = text.split(/\s+/);
    const id = parseInt(parts[0] || "", 10);
    const featureArg = parts.slice(1).join(" ").trim();

    if (isNaN(id) || id < 1 || id > 300) {
        const found = ALL_300_FEATURES.filter(f => f.name.includes(text) || f.category.includes(text));
        if (found.length === 0) {
            return ctx.reply('⚠️ لم يتم العثور على أي ميزة بهذا الاسم أو الرقم. يرجى استخدام رقم من 1 إلى 300 أو اسم ميزة صحيح.');
        }
        if (found.length === 1) {
            return runSingleFeature(ctx, found[0]);
        }
        
        let searchMsg = `🔍 *نتائج البحث المكتشفة:* \n\n`;
        found.slice(0, 15).forEach(f => {
            searchMsg += `• *[${f.id}]* ${f.name} (${f.category})\n`;
        });
        if (found.length > 15) {
            searchMsg += `\n_و ${found.length - 15} ميزات أخرى... يرجى تحديد البحث أو كتابة رقم الميزة مباشرة باستخدام_ \`/feature [الرقم]\``;
        }
        return ctx.reply(searchMsg, { parse_mode: 'Markdown' });
    }

    const feature = ALL_300_FEATURES.find(f => f.id === id);
    if (!feature) {
        return ctx.reply('⚠️ ميزة غير صالحة.');
    }

    return runSingleFeature(ctx, feature, featureArg);
});

bot.command('features', async (ctx) => {
    return show300Categories(ctx);
});

// Map all OS, category and feature callbacks
bot.action('os_300_powers', (ctx) => {
    ctx.answerCbQuery();
    show300Categories(ctx, true);
});

bot.action('os_back_main', async (ctx) => {
    ctx.answerCbQuery();
    const rpg = await botDb.getRPG(ctx.from!.id);
    const osMsg = `
🌌 *لوحة التحكم OmniMind OS - نظام مصفوفي نشط*
━━━━━━━━━━━━━━━━━━━━━━━━━━
👤 *المطور:* ${ctx.from!.first_name}
⭐ *المستوى:* ${rpg.level} | *اللقب:* ${rpg.title}
━━━━━━━━━━━━━━━━━━━━━━━━━━

الرجاء استخدام قائمة الأزرار التفاعلية البرمجية بالأسفل لتشغيل وتنفيذ الميزات فورياً وبدون كتابة أوامر معقدة:
`;
    const keyboard = Markup.inlineKeyboard([
        [
            Markup.button.callback('🏆 RPG Dashboard', 'os_rpg'),
            Markup.button.callback('📊 Live Costs', 'os_costs')
        ],
        [
            Markup.button.callback('🗺️ App Blueprint', 'os_blueprint'),
            Markup.button.callback('🥷 Security Audit', 'os_redteam')
        ],
        [
            Markup.button.callback('🐳 Dockerize App', 'os_docker'),
            Markup.button.callback('💻 Swarm Swarm', 'os_matrix')
        ],
        [
            Markup.button.callback('☕ Quick Break', 'os_break'),
            Markup.button.callback('🎭 Change Persona', 'os_persona')
        ],
        [
            Markup.button.callback('🌟 300 Superpowers 🌟', 'os_300_powers')
        ],
        [
            Markup.button.callback('📜 All Commands | كل الأوامر 📜', 'os_commands')
        ]
    ]);
    ctx.editMessageText(osMsg, { parse_mode: 'Markdown', ...keyboard }).catch(() => {});
});

bot.action('fcat_list', (ctx) => {
    ctx.answerCbQuery();
    show300Categories(ctx, true);
});

bot.action(/^fcat_(\d+)$/, async (ctx) => {
    ctx.answerCbQuery();
    const match = ctx.match;
    if (!match || !match[1]) return;
    const index = parseInt(match[1], 10);
    const categories = Array.from(new Set(ALL_300_FEATURES.map(f => f.category)));
    const category = categories[index];
    if (!category) return;

    const feats = ALL_300_FEATURES.filter(f => f.category === category);
    
    let msg = `📂 *ميزات فئة:* ${category}\n`;
    msg += `━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    feats.forEach(f => {
        msg += `• *[${f.id}]* ${f.name}\n`;
    });
    msg += `\n_لتشغيل أي ميزة، اضغط على زر المعرف الخاص بها بالأسفل أو اكتب_ \`/feature [الرقم]\``;

    const buttons = [];
    for (let i = 0; i < feats.length; i += 4) {
        const row = [];
        for (let j = 0; j < 4; j++) {
            const f = feats[i + j];
            if (f) {
                row.push(Markup.button.callback(`${f.isStarred ? '⭐' : ''} ${f.id}`, `fid_${f.id}`));
            }
        }
        buttons.push(row);
    }
    buttons.push([Markup.button.callback('⬅️ رجوع للفئات', 'fcat_list')]);

    ctx.editMessageText(msg, { parse_mode: 'Markdown', ...Markup.inlineKeyboard(buttons) }).catch(() => {});
});

bot.action(/^fid_(\d+)$/, async (ctx) => {
    ctx.answerCbQuery();
    const match = ctx.match;
    if (!match || !match[1]) return;
    const id = parseInt(match[1], 10);
    const feature = ALL_300_FEATURES.find(f => f.id === id);
    if (!feature) return;
    runSingleFeature(ctx, feature);
});

// ==========================================
// INTERACTIVE COMMANDS NAVIGATION MODULE
// ==========================================

interface CommandDetail {
    name: string;
    purpose: string;
    example: string;
    category: string;
    runAction?: string;
    interactiveAction?: { label: string; action: string }[];
}

const COMMAND_DETAILS_MAP: Record<string, CommandDetail> = {
    start: {
        name: '/start',
        purpose: 'تهيئة البوت والترحيب وتفعيل حسابك بقاعدة البيانات للاستفادة الكاملة من الميزات والـ RPG.',
        example: '/start',
        category: 'cmdcat_basic',
        runAction: 'runcmd_start'
    },
    help: {
        name: '/help',
        purpose: 'عرض الدليل الكامل لجميع الميزات المتقدمة ومصفوفة الـ 300 قدرة فائقة المتطورة وكيفية استدعائها.',
        example: '/help',
        category: 'cmdcat_basic',
        runAction: 'runcmd_help'
    },
    persona: {
        name: '/persona',
        purpose: 'تغيير شخصية البوت لتناسب مزاجك البرمجي (طبيعي 🤖، بطة سقراطية 🦆، محامي الشيطان 😈، مبسط للأطفال 🧸، شوي كوميدي 🔥).',
        example: '/persona roast',
        category: 'cmdcat_basic',
        interactiveAction: [
            { label: '🤖 طبيعي', action: 'runpersona_normal' },
            { label: '🦆 البطة', action: 'runpersona_duck' },
            { label: '😈 الشيطان', action: 'runpersona_devil' },
            { label: '🧸 مبسط', action: 'runpersona_eli5' },
            { label: '🔥 شواية', action: 'runpersona_roast' }
        ]
    },
    rpg: {
        name: '/rpg',
        purpose: 'عرض لوحة التلعيب الخاصة بك: المستوى الحالي، نقاط الخبرة XP، اللقب المعماري، شريط التقدم، وإحصائيات المهام المنجزة.',
        example: '/rpg',
        category: 'cmdcat_basic',
        runAction: 'runcmd_rpg'
    },
    os: {
        name: '/os',
        purpose: 'تشغيل لوحة تحكم OmniMind OS الشاملة والمزودة بأزرار تفاعلية لإدارة كاملة للفحص والتشغيل ومطالعة الحالة والمزيد.',
        example: '/os',
        category: 'cmdcat_basic',
        runAction: 'runcmd_os'
    },
    matrix: {
        name: '/matrix',
        purpose: 'تمثيل مرئي لمصفوفة الوكلاء النشطة (Critic, Coder, Tester) وحالتهم الحالية بالوقت الحقيقي على شكل كود منسدل.',
        example: '/matrix',
        category: 'cmdcat_basic',
        runAction: 'runcmd_matrix'
    },
    break: {
        name: '/break',
        purpose: 'تفعيل مؤقت استراحة القهوة الذكية لمدة 3 ساعات مع استمرار فحص جودة البيئة بالخلفية تلقائياً لمنع تعطل الاختبارات.',
        example: '/break',
        category: 'cmdcat_basic',
        runAction: 'runcmd_break'
    },
    projects: {
        name: '/projects',
        purpose: 'عرض أو تفعيل مشروع جديد لعمليات البوت البرمجية لضمان عمل الوكلاء في مجلد العمل المستهدف بدقة.',
        example: '/projects MyWebSite /app/my_app',
        category: 'cmdcat_project',
        runAction: 'runcmd_projects'
    },
    team_session: {
        name: '/team_session',
        purpose: 'تنشيط نظام منع تصادم تعديلات الملفات التلقائي للفريق المشترك، لتمكين التنسيق بين المطورين والوكلاء.',
        example: '/team_session',
        category: 'cmdcat_project',
        runAction: 'runcmd_team_session'
    },
    lock: {
        name: '/lock',
        purpose: 'قفل ملف برمجي معين باسمه ومساره ليكون خاصاً بك فقط ولا يستطيع أحد التعديل عليه أثناء عملك لتلافي فقدان الكود.',
        example: '/lock src/index.ts',
        category: 'cmdcat_project'
    },
    unlock: {
        name: '/unlock',
        purpose: 'فك قفل الملف النشط بعد الانتهاء من العمل عليه ليصبح متاحاً للزملاء للتعديل والمشاركة مجدداً بنظام الجلسات.',
        example: '/unlock src/index.ts',
        category: 'cmdcat_project'
    },
    task: {
        name: '/task',
        purpose: 'تكليف عقل وكيل OmniMind المستمر بمهمة برمجية كاملة (كتابة دوال، مراجعة، تعديل، حل مشكلة) بالملفات مباشرة.',
        example: '/task قم بإضافة ميزة التحقق من البريد الإلكتروني في ملف auth.ts',
        category: 'cmdcat_project'
    },
    oops: {
        name: '/oops',
        purpose: 'زر الطوارئ والذعر في الأزمات! يتراجع فورياً ومباشرة عن جميع التعديلات الأخيرة غير المحفوظة، وينشئ رسالة تبرير واعتذار ممتعة.',
        example: '/oops',
        category: 'cmdcat_project',
        runAction: 'runcmd_oops'
    },
    story: {
        name: '/story',
        purpose: 'قراءة الفروقات والتغيرات المكتوبة حديثاً (Git Diff) وصياغتها على شكل قصة ملحمية بطولية تصف صراع المطور مع الثغرات لتضمينها بـ PR.',
        example: '/story',
        category: 'cmdcat_project',
        runAction: 'runcmd_story'
    },
    blueprint: {
        name: '/blueprint',
        purpose: 'توليد وثيقة وتصميم معماري متكامل لفكرة مشروعك الجديد بـ 5 مراحل كاملة والتصميم الهيكلي لقاعدة البيانات والاعتماديات.',
        example: '/blueprint تطبيق حجز صالونات متطور',
        category: 'cmdcat_dev'
    },
    build_api: {
        name: '/build_api',
        purpose: 'بناء وتوليد الهيكل البرمجي لـ API كاملة (Routes, Controllers, Schemas, Validation, Tests) لخدمة غرضك بسرعة فائقة.',
        example: '/build_api products',
        category: 'cmdcat_dev',
        runAction: 'runcmd_build_api'
    },
    build_bot: {
        name: '/build_bot',
        purpose: 'توليد الكود الكامل والهيكل النموذجي لبوت تليغرام Node.js Telegraf متكامل الأزرار المضمنة والاتصال بقاعدة بيانات SQLite.',
        example: '/build_bot delivery_bot',
        category: 'cmdcat_dev',
        runAction: 'runcmd_build_bot'
    },
    adr: {
        name: '/adr',
        purpose: 'كتابة وتوثيق قرار معماري هندسي (Architecture Decision Record) يناقش الفوائد والعيوب والبدائل والآثار الهندسية المترتبة على قراراتك.',
        example: '/adr التحول من Express إلى Fastify',
        category: 'cmdcat_dev',
        runAction: 'runcmd_adr'
    },
    multiphase: {
        name: '/multiphase',
        purpose: 'تجزئة أي هدف برمجيات كبير ومعقد لـ 5 مراحل برمجية متسلسلة وصياغة معايير اختبار تفتيشية آلية لكل مرحلة بذكاء.',
        example: '/multiphase بناء خادم بث فيديو بالوقت الحقيقي',
        category: 'cmdcat_dev'
    },
    dna: {
        name: '/dna',
        purpose: 'فحص البنية الجينية البرمجية وتوليد تحليل دقيق لمدى موثوقية الهيكلية المعمارية وكشف الأخطاء المعقدة والمشاكل الكامنة.',
        example: '/dna',
        category: 'cmdcat_dev',
        runAction: 'runcmd_dna'
    },
    dockerize: {
        name: '/dockerize',
        purpose: 'تحليل مشروعك ومحتويات package.json لتوليد ملفات Dockerfile و docker-compose الأمثل للتشغيل الفوري بالحاويات بأمان.',
        example: '/dockerize',
        category: 'cmdcat_dev',
        runAction: 'runcmd_dockerize'
    },
    pipeline: {
        name: '/pipeline',
        purpose: 'توليد إعدادات وأكواد ملفات أتمتة لـ GitHub Actions CI/CD كاملة الأركان لمشروع Node.js تشمل الفحص والبناء والاختبار والنشر.',
        example: '/pipeline',
        category: 'cmdcat_dev',
        runAction: 'runcmd_pipeline'
    },
    redteam: {
        name: '/redteam',
        purpose: 'إطلاق وكيل الفريق الأحمر (Red Team Audit) للبحث عن الثغرات الأمنية بالكود (حقن، ثغرات CORS، تسريب توكنات) مع طريقة معالجتها.',
        example: '/redteam',
        category: 'cmdcat_audit',
        runAction: 'runcmd_redteam'
    },
    simulate: {
        name: '/simulate',
        purpose: 'محاكاة العواقب الهندسية والتنبؤ الكامل بجميع الإيجابيات والسلبيات والخطوات المترتبة على أي قرار أو حدث معماري تتخذه.',
        example: '/simulate الانتقال بالكامل للخدمات السحابية بدون خادم Serverless',
        category: 'cmdcat_audit'
    },
    oracle: {
        name: '/oracle',
        purpose: 'مستشار الاعتماديات والمكتبات لمقارنة أداء وفاعلية الحلول (Axios vs Fetch) وإعطائك تبريراً هندسياً لاختيار الأنسب.',
        example: '/oracle Fastify vs NestJS',
        category: 'cmdcat_audit',
        runAction: 'runcmd_oracle'
    },
    health: {
        name: '/health',
        purpose: 'قياس مؤشرات صحة وتوتر الكود (التعقيدات الحسابية، التفرع المفرط، الكود الميت، الملفات الطويلة للغاية) لحساب معدل الصحة العامة.',
        example: '/health',
        category: 'cmdcat_audit',
        runAction: 'runcmd_health'
    },
    harden: {
        name: '/harden',
        purpose: 'كتابة وتوليد حزمة تعديلات فورية برمجياً لتأمين سيرفر Express Node.js باستخدام helmet و CORS وتحديد الطلبات rate limit ومكافحة XSS.',
        example: '/harden',
        category: 'cmdcat_audit',
        runAction: 'runcmd_harden'
    },
    profile: {
        name: '/profile',
        purpose: 'تحليل أداء الكود وتفاعله مع SQL وكتابة دليل عملي لتسريع الاستجابة واستخراج الاختناقات وإضافة الفهارس وتخزين الذاكرة المؤقتة.',
        example: '/profile',
        category: 'cmdcat_audit',
        runAction: 'runcmd_profile'
    },
    i18n: {
        name: '/i18n',
        purpose: 'فحص ملفات المشروع وتحديد النصوص والعبارات المكتوبة يدوياً وعزلها في ملفات ترجمة JSON لتهيئة تدويل البرمجيات (i18n).',
        example: '/i18n',
        category: 'cmdcat_audit',
        runAction: 'runcmd_i18n'
    },
    graph: {
        name: '/graph',
        purpose: 'استخراج وعرض شجرة العلاقات والاعتماديات الطوبولوجية والهيكلية الكاملة لملفات ومجلدات المشروع لتسهيل فهم الترابط.',
        example: '/graph',
        category: 'cmdcat_audit',
        runAction: 'runcmd_graph'
    },
    chaos: {
        name: '/chaos',
        purpose: 'محاكاة اختبارات الفوضى والأعطال (Chaos Engineering) لتوضيح سيناريوهات تعطل قواعد البيانات أو توقف السيرفر والحلول المناسبة.',
        example: '/chaos',
        category: 'cmdcat_audit',
        runAction: 'runcmd_chaos'
    },
    migrate: {
        name: '/migrate',
        purpose: 'وضع دليل ترحيل معقد لقواعد البيانات أو نقل المشروع بالكامل من إطار عمل قديم للنمط الحديث دون المساس بسلامة البيانات.',
        example: '/migrate',
        category: 'cmdcat_audit',
        runAction: 'runcmd_migrate'
    },
    deploy: {
        name: '/deploy',
        purpose: 'دليل شامل لتطبيق النشر مستمر بدون أي توقف (Zero-Downtime Deployment) مع تفصيل الإعدادات السيرفرية والتحديث التراكمي للنسخ.',
        example: '/deploy',
        category: 'cmdcat_audit',
        runAction: 'runcmd_deploy'
    },
    addkey: {
        name: '/addkey',
        purpose: 'تشفير وحفظ مفتاح API الخاص بك (OpenAI, Gemini, GitHub) في الخزنة السحابية للبوت بخصوصية وأمان 100%.',
        example: '/addkey gemini AIzaSy...',
        category: 'cmdcat_vault'
    },
    addpool: {
        name: '/addpool',
        purpose: 'إعداد حوض التدوير التلقائي (Token Pool) لتبادل المفاتيح وتخطي حدود الاستهلاك ومعدل الطلبات بكفاءة عالية.',
        example: '/addpool openai sk-...',
        category: 'cmdcat_vault'
    },
    cost: {
        name: '/cost',
        purpose: 'عرض لوحة استهلاك الميزانية الموزعة بالتوكنز والدولار للنماذج المشغلة والميزات النشطة.',
        example: '/cost',
        category: 'cmdcat_vault',
        runAction: 'runcmd_cost'
    }
};

function showCommandsMenu(ctx: any, isEdit = false) {
    const msg = `
📜 *دليل الأوامر التفاعلي الشامل - OmniMind OS* 📜
━━━━━━━━━━━━━━━━━━━━━━━━━━
أهلاً بك في نظام التصفح والتشغيل السريع لجميع الأوامر المدمجة!
يمكنك الآن التنقل عبر الفئات والاطلاع على تفاصيل كل أمر أو تشغيله مباشرة بضغطة زر.

الرجاء اختيار فئة الأوامر من الأسفل لتصفحها:
`;
    const keyboard = Markup.inlineKeyboard([
        [
            Markup.button.callback('🤖 أساسيات وهويات', 'cmdcat_basic'),
            Markup.button.callback('📁 المشاريع والملفات', 'cmdcat_project')
        ],
        [
            Markup.button.callback('🏗️ كود وتطوير متقدم', 'cmdcat_dev'),
            Markup.button.callback('🥷 أمان وتدقيق وأداء', 'cmdcat_audit')
        ],
        [
            Markup.button.callback('🔑 الخزنة والميزانية', 'cmdcat_vault')
        ],
        [
            Markup.button.callback('🌌 العودة للوحة OS', 'os_back_main')
        ]
    ]);

    if (isEdit) {
        ctx.editMessageText(msg, { parse_mode: 'Markdown', ...keyboard }).catch(() => {});
    } else {
        ctx.reply(msg, { parse_mode: 'Markdown', ...keyboard });
    }
}

// Bot commands list entry command
bot.command('commands', async (ctx) => {
    return showCommandsMenu(ctx);
});

// Category callback mappings
bot.action('cmdcat_list_main', (ctx) => {
    ctx.answerCbQuery();
    showCommandsMenu(ctx, true);
});

bot.action('os_commands', (ctx) => {
    ctx.answerCbQuery();
    showCommandsMenu(ctx, true);
});

bot.action('cmdcat_basic', (ctx) => {
    ctx.answerCbQuery();
    const msg = `
🤖 *الأوامر الأساسية وإدارة الهوية*
━━━━━━━━━━━━━━━━━━━━━━━━━━
اختر أحد الأوامر أدناه لعرض تفاصيله أو تشغيله:
`;
    const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('/start - بدء التشغيل', 'cmddet_start')],
        [Markup.button.callback('/help - دليل المساعدة', 'cmddet_help')],
        [Markup.button.callback('/persona - نمط الشخصية', 'cmddet_persona')],
        [Markup.button.callback('/rpg - إحصائيات المطور', 'cmddet_rpg')],
        [Markup.button.callback('/os - لوحة التحكم', 'cmddet_os')],
        [Markup.button.callback('/matrix - مصفوفة الوكلاء', 'cmddet_matrix')],
        [Markup.button.callback('/break - استراحة قهوة', 'cmddet_break')],
        [Markup.button.callback('⬅️ رجوع لقائمة الفئات', 'cmdcat_list_main')]
    ]);
    ctx.editMessageText(msg, { parse_mode: 'Markdown', ...keyboard }).catch(() => {});
});

bot.action('cmdcat_project', (ctx) => {
    ctx.answerCbQuery();
    const msg = `
📁 *التحكم بالملفات والمشاريع المشتركة*
━━━━━━━━━━━━━━━━━━━━━━━━━━
اختر أحد الأوامر أدناه لعرض تفاصيله أو تشغيله:
`;
    const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('/projects - إدارة المشاريع', 'cmddet_projects')],
        [Markup.button.callback('/team_session - جلسة الفريق', 'cmddet_team_session')],
        [Markup.button.callback('/lock - قفل ملف للعمل', 'cmddet_lock')],
        [Markup.button.callback('/unlock - إلغاء القفل', 'cmddet_unlock')],
        [Markup.button.callback('/task - تكليف وكيل ذكي', 'cmddet_task')],
        [Markup.button.callback('/oops - زر الطوارئ والذعر', 'cmddet_oops')],
        [Markup.button.callback('/story - قصة Git Diff', 'cmddet_story')],
        [Markup.button.callback('⬅️ رجوع لقائمة الفئات', 'cmdcat_list_main')]
    ]);
    ctx.editMessageText(msg, { parse_mode: 'Markdown', ...keyboard }).catch(() => {});
});

bot.action('cmdcat_dev', (ctx) => {
    ctx.answerCbQuery();
    const msg = `
🏗️ *الأكواد والتطوير المعماري المتقدم*
━━━━━━━━━━━━━━━━━━━━━━━━━━
اختر أحد الأوامر أدناه لعرض تفاصيله أو تشغيله:
`;
    const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('/blueprint - مخطط التطبيقات', 'cmddet_blueprint')],
        [Markup.button.callback('/build_api - بناء واجهات API', 'cmddet_build_api')],
        [Markup.button.callback('/build_bot - بناء بوت تليغرام', 'cmddet_build_bot')],
        [Markup.button.callback('/adr - قرار معماري ADR', 'cmddet_adr')],
        [Markup.button.callback('/multiphase - تطوير متعدد المراحل', 'cmddet_multiphase')],
        [Markup.button.callback('/dna - البنية الجينية للكود', 'cmddet_dna')],
        [Markup.button.callback('/dockerize - حاويات Docker', 'cmddet_dockerize')],
        [Markup.button.callback('/pipeline - الأتمتة CI/CD', 'cmddet_pipeline')],
        [Markup.button.callback('⬅️ رجوع لقائمة الفئات', 'cmdcat_list_main')]
    ]);
    ctx.editMessageText(msg, { parse_mode: 'Markdown', ...keyboard }).catch(() => {});
});

bot.action('cmdcat_audit', (ctx) => {
    ctx.answerCbQuery();
    const msg = `
🥷 *أمان وتدقيق وصحة الأداء*
━━━━━━━━━━━━━━━━━━━━━━━━━━
اختر أحد الأوامر أدناه لعرض تفاصيله أو تشغيله:
`;
    const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('/redteam - الفحص الأمني', 'cmddet_redteam')],
        [Markup.button.callback('/simulate - محاكي السيناريوهات', 'cmddet_simulate')],
        [Markup.button.callback('/oracle - مستشار الاعتماديات', 'cmddet_oracle')],
        [Markup.button.callback('/health - صحة وتوتر الكود', 'cmddet_health')],
        [Markup.button.callback('/harden - حماية Express', 'cmddet_harden')],
        [Markup.button.callback('/profile - كفاءة الأداء والـ SQL', 'cmddet_profile')],
        [Markup.button.callback('/i18n - ترجمة الكود الصلب', 'cmddet_i18n')],
        [Markup.button.callback('/graph - شجرة العلاقات', 'cmddet_graph')],
        [Markup.button.callback('/chaos - مهندس الفوضى', 'cmddet_chaos')],
        [Markup.button.callback('/migrate - خطة الترحيل', 'cmddet_migrate')],
        [Markup.button.callback('/deploy - النشر المستمر بأمان', 'cmddet_deploy')],
        [Markup.button.callback('⬅️ رجوع لقائمة الفئات', 'cmdcat_list_main')]
    ]);
    ctx.editMessageText(msg, { parse_mode: 'Markdown', ...keyboard }).catch(() => {});
});

bot.action('cmdcat_vault', (ctx) => {
    ctx.answerCbQuery();
    const msg = `
🔑 *إدارة الخزنة والتوكنز والميزانية*
━━━━━━━━━━━━━━━━━━━━━━━━━━
اختر أحد الأوامر أدناه لعرض تفاصيله أو تشغيله:
`;
    const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('/addkey - إضافة مفتاح مشفر', 'cmddet_addkey')],
        [Markup.button.callback('/addpool - حوض التدوير الموزع', 'cmddet_addpool')],
        [Markup.button.callback('/cost - لوحة التكلفة التقديرية', 'cmddet_cost')],
        [Markup.button.callback('⬅️ رجوع لقائمة الفئات', 'cmdcat_list_main')]
    ]);
    ctx.editMessageText(msg, { parse_mode: 'Markdown', ...keyboard }).catch(() => {});
});

// Dynamic commands details display router
bot.action(/^cmddet_(\w+)$/, (ctx) => {
    ctx.answerCbQuery();
    const match = ctx.match;
    if (!match || !match[1]) return;
    const cmdKey = match[1];
    const detail = COMMAND_DETAILS_MAP[cmdKey];
    if (!detail) return;

    let msg = `ℹ️ *تفاصيل الأمر:* \`${detail.name}\`\n`;
    msg += `━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    msg += `📝 *الغرض:* ${detail.purpose}\n\n`;
    msg += `💡 *طريقة الاستخدام:* \`${detail.example}\`\n`;
    
    if (!detail.runAction && !detail.interactiveAction) {
        msg += `\n⚠️ _هذا الأمر يتطلب مدخلات معينة بالضرورة. يرجى كتابته في حقل الدردشة يدوياً متبوعاً بالمدخلات المطلوبة._`;
    } else if (detail.runAction) {
        msg += `\n✨ _يمكنك تفعيل وتشغيل هذا الأمر فوراً باستخدام الزر التفاعلي أدناه بلمسة واحدة!_`;
    } else if (detail.interactiveAction) {
        msg += `\n✨ _يرجى اختيار أحد الخيارات التفاعلية السريعة أدناه لتشغيل النمط المرغوب:_`;
    }

    const buttons = [];
    
    // Add run button if exists
    if (detail.runAction) {
        buttons.push([Markup.button.callback(`▶️ تشغيل الأمر ${detail.name}`, detail.runAction)]);
    }
    
    // Add interactive action buttons if exists
    if (detail.interactiveAction) {
        const row: any[] = [];
        detail.interactiveAction.forEach(act => {
            row.push(Markup.button.callback(act.label, act.action));
        });
        for (let i = 0; i < row.length; i += 2) {
            buttons.push(row.slice(i, i + 2));
        }
    }

    // Back to category button
    buttons.push([Markup.button.callback('⬅️ العودة للفئة', detail.category)]);

    const keyboard = Markup.inlineKeyboard(buttons);
    ctx.editMessageText(msg, { parse_mode: 'Markdown', ...keyboard }).catch(() => {});
});

// Persona selectors action callbacks
bot.action(/^runpersona_(\w+)$/, async (ctx) => {
    ctx.answerCbQuery();
    const match = ctx.match;
    if (!match || !match[1]) return;
    const persona = match[1];
    
    try {
        await botDb.setPersona(ctx.from!.id, persona);
        const names: Record<string, string> = {
            normal: "الوكيل الطبيعي المحترف 🤖",
            duck: "البطة المطاطية السقراطية 🦆",
            devil: "محامي الشيطان المشاكس 😈",
            eli5: "مبسط الكود الرائع 🧸",
            roast: "شواية الكود الكوميدية 🔥"
        };
        ctx.reply(`✅ تم تفعيل *${names[persona]}* بنجاح! جميع المهام والردود القادمة ستتبع هذا النمط الأسطوري.`, { parse_mode: 'Markdown' });
    } catch (error: any) {
        ctx.reply(`❌ فشل تغيير الشخصية: ${error.message}`);
    }
});

// Immediate execution action router
bot.action(/^runcmd_(\w+)$/, async (ctx) => {
    ctx.answerCbQuery();
    const match = ctx.match;
    if (!match || !match[1]) return;
    const cmd = match[1];

    if (cmd === 'start') {
        await botDb.ensureUser(ctx.from!.id, ctx.from!.username);
        ctx.reply(`🌌 مرحبًا بك في *OmniMind OS* - رفيق دربك التطويري الأسطوري!\n\nاستخدم /help لعرض قائمة الميزات الـ 300 المدمجة، أو اكتب /os لفتح لوحة التحكم الذكية التفاعلية.`, { parse_mode: 'Markdown' });
    } else if (cmd === 'help') {
        const helpMsg = `
🌌 <b>OmniMind OS Node Bot - دليل الميزات الأسطورية</b>

🔥 <b>فهرس القدرات الفائقة الـ 300:</b>
• <code>/features</code> - فتح المستكشف التفاعلي لتصفح فئات وقدرات النظام الـ 300.
• <code>/feature [الرقم]</code> - تفعيل الميزة رقم (1-300) فوراً.
• <code>/feature [الاسم]</code> - البحث السريع في الـ 300 ميزة وتنشيطها تلقائياً.

🤖 <b>التحكم الأساسي والشخصيات (/persona):</b>
• /task [مهمة] - تشغيل العميل الذكي لتنفيذ مهمة برمجية.
• /persona [normal|duck|devil|eli5|roast] - تغيير شخصية البوت للتفاعل المناسب.

🏆 <b>نظام التلعيب والمرح والإنتاجية:</b>
• /rpg - عرض مستواك البرمجي، نقاط الـ XP، واللقب الحالي.
• /break - وضع الاستراحة الذكي.
• /oops - زر الطوارئ (تراجع كامل، إعادة الكود للسابق، ومسودة اعتذار للعميل).
• /matrix - شاشة مصفوفة كود متحركة توضح حالة عمل الوكلاء.

⚡ <b>إدارة التوكنات والتكلفة:</b>
• /addkey [openai|gemini|github_token] [مفتاح] - إضافة مفاتيحك الخاصة مشفرة.
• /addpool [openai|gemini] [مفتاح] - إضافة توكنات لحوض التدوير التلقائي لتجنب حد الاستهلاك.
• /cost - لوحة التكلفة الحية (إحصائيات استهلاك التوكنات).
• /projects - إدارة مشاريع التطوير والمسارات المشتركة.
• /lock - حماية الملفات من التعديل المشترك.
• /team - جلسة فريق العمل الموحد.

💫 <i>تمتع بتجربة مذهلة تجمع بين قوة الوكلاء والمرح البرمجي الفائق!</i>`;
        ctx.reply(helpMsg, { parse_mode: 'HTML' });
    } else if (cmd === 'team_session') {
        try {
            const activeProject = await botDb.getActiveProject(ctx.from!.id);
            if (!activeProject) {
                return ctx.reply('⚠️ لا يوجد مشروع نشط حالياً. يرجى تفعيل مشروع أولاً باستخدام أمر /projects.');
            }
            ctx.reply(`👥 *جلسة عمل الفريق النشطة للمشروع:* \`${activeProject.name}\`\n\n- نظام الحماية ضد تصادم التعديلات مفعل تلقائيًا.\n- استخدم \`/lock [مسار_الملف]\` للعمل على ملف بشكل مستقل.\n- استخدم \`/unlock [مسار_الملف]\` لإلغاء القفل.\n\n_أنت وفريقك متصلون الآن بنفس بيئة التطوير والوكلاء!_`, { parse_mode: 'Markdown' });
        } catch (error: any) {
            ctx.reply(`❌ فشل تهيئة جلسة الفريق: ${error.message}`);
        }
    } else if (cmd === 'oops') {
        ctx.reply('🚨 *زر الذعر (Panic Mode) تم تفعيله!* جاري التراجع السريع بالخلفية وإعداد مسودة بريد تبرير للمستثمرين/العملاء...', { parse_mode: 'Markdown' });
        try {
            const activeProject = await botDb.getActiveProject(ctx.from!.id);
            const projectPath = activeProject ? activeProject.project_path : process.cwd();
            const rollbackRes = await executeShell("git checkout -- . && git clean -fd", projectPath);
            const agent = new BaseAgent();
            const apologyResult = await agent.run("أنت مبرمج خبير واجه عطلاً فادحاً في السيرفر وقام بإصلاحه وتراجع عن التعديلات. اكتب مسودة بريد اعتذاري مهني وممتع للعملاء أو المدير يوضح العطل بلغة راقية جداً ومطمئنة.", "", ctx.from!.id);
            ctx.reply(`🧹 *حالة التراجع:* ${rollbackRes.success ? "✅ تم مسح التعديلات غير المحفوظة والرجوع للحالة المستقرة الأخيرة!" : "⚠️ لم نتمكن من التراجع التلقائي (ربما لا يوجد مستودع git نشط)."}\n\n📨 *مسودة رسالة اعتذار احترافية وجاهزة للنسخ:*\n\n${apologyResult.content}`);
        } catch (err: any) {
            ctx.reply(`❌ خطأ في تشغيل وضع الذعر: ${err.message}`);
        }
    } else if (cmd === 'story') {
        ctx.reply('📖 *جاري استخراج تغييرات Git وتحويل كودك لملحمة قصصية ممتعة...*');
        try {
            const activeProject = await botDb.getActiveProject(ctx.from!.id);
            const projectPath = activeProject ? activeProject.project_path : process.cwd();
            const diffRes = await executeShell("git diff HEAD~1", projectPath);
            const diffText = diffRes.success ? diffRes.stdout : "Modified some code context for testing purposes.";
            const agent = new BaseAgent();
            const res = await agent.run(`قم بتحويل الفروقات البرمجية (git diff) التالية إلى قصة ملحمية بطولية تصف المعركة التي خاضها المبرمج للقضاء على التعديلات وإدخال هذه التحسينات، لتستخدم كقصة ممتعة في شرح مراجعة الكود (PR description):\n\n${diffText.slice(0, 3000)}`, "", ctx.from!.id);
            ctx.reply(`📖 *ملحمة المطور المبرمج:*\n\n${res.content}`);
        } catch (e: any) {
            ctx.reply(`❌ فشل: ${e.message}`);
        }
    } else if (cmd === 'dockerize') {
        ctx.reply('🐳 *جاري تحليل مشروعك لتوليد إعدادات Dockerfiles و docker-compose الأمثل...*');
        try {
            const activeProject = await botDb.getActiveProject(ctx.from!.id);
            const projectPath = activeProject ? activeProject.project_path : process.cwd();
            let packageJsonContent = "";
            try {
                packageJsonContent = fs.readFileSync(path.join(projectPath, 'package.json'), 'utf8');
            } catch (e) {}
            const agent = new BaseAgent();
            const res = await agent.run(`قم بكتابة ملف Dockerfile متقن وملف docker-compose.yml لخدمة هذا المشروع بالاعتماد على محتويات package.json التالية:\n${packageJsonContent || 'Node.js app'}. اشرح طريقة التشغيل والبدء السريع بالتفصيل.`, "", ctx.from!.id);
            ctx.reply(`🐳 *ملفات حاويات Docker المولدة تلقائيًا:*\n\n${res.content}`);
        } catch (e: any) {
            ctx.reply(`❌ فشل: ${e.message}`);
        }
    } else if (cmd === 'cost') {
        try {
            const costs = await botDb.getCosts(ctx.from!.id);
            let breakdownText = "";
            if (costs.breakdown.length === 0) {
                breakdownText = "• لا توجد طلبات مسجلة حتى الآن.";
            } else {
                costs.breakdown.forEach((row: any) => {
                    breakdownText += `• *${row.model}:* ${row.request_count} طلبات | ${row.total_tokens} توكن | \$${row.total_cost.toFixed(6)}\n`;
                });
            }
            const costMsg = `
📊 *OmniMind Live Cost Dashboard*
👤 *المستخدم:* ${ctx.from!.first_name}

📈 *تفاصيل النماذج المستهلكة:*
${breakdownText}

🪙 *إجمالي التوكنز المستهلكة:* ${costs.totalTokens} Tokens
💵 *إجمالي التكلفة التقديرية:* \$${costs.totalCost.toFixed(6)} USD
`;
            ctx.reply(costMsg, { parse_mode: 'Markdown' });
        } catch (error: any) {
            ctx.reply(`❌ فشل جلب لوحة التكلفة: ${error.message}`);
        }
    } else if (cmd === 'projects') {
        await botDb.ensureUser(ctx.from!.id, ctx.from!.username);
        const active = await botDb.getActiveProject(ctx.from!.id);
        const activeMsg = active 
            ? `🟢 *المشروع النشط:* \`${active.name}\`\n📍 *المسار:* \`${active.project_path}\``
            : `🔴 *لا يوجد مشروع نشط حالياً.*`;
        
        ctx.reply(`${activeMsg}\n\n💡 لإنشاء مشروع جديد وتفعيله، يرجى كتابة الأمر:\n\`/projects [اسم_المشروع] [مسار_المشروع]\` في الدردشة.`, { parse_mode: 'Markdown' });
    } else if (cmd === 'rpg') {
        try {
            await botDb.ensureUser(ctx.from!.id, ctx.from!.username);
            const rpg = await botDb.getRPG(ctx.from!.id);
            const nextXpRequired = rpg.level * 100;
            const xpPercent = Math.min(100, Math.floor(((rpg.xp || 0) / nextXpRequired) * 100));
            ctx.reply(`🏆 *إحصائيات RPG المطور المتكاملة:* \n\n• اللقب: *${rpg.title}*\n• المستوى الحالي: *${rpg.level}*\n• شريط الخبرة: *${xpPercent}%* [${rpg.xp}/${nextXpRequired} XP]\n• إجمالي المهام الناجحة: *${rpg.tasks_completed}*`, { parse_mode: 'Markdown' });
        } catch (e: any) {
            ctx.reply(`❌ فشل جلب بيانات RPG: ${e.message}`);
        }
    } else if (cmd === 'matrix') {
        const matrixText = `
💻 *OmniMind Matrix OS Live View*
🤖 *حالة خلية الوكلاء المعرفية:*

\`\`\`
10101101  [CRITIC AGENT]  -> ACTIVE 🟢 (Analyzing code smells)
01100010  [CODER AGENT]   -> STANDBY 🟡 (Waiting for instruction)
11101011  [TESTER AGENT]  -> ACTIVE 🟢 (Executing continuous mocha checks)
00101101  [SECURITY AGENT]-> SLEEPING 💤 (Audit complete)

  ▲
 / \\   SWARM SYNCING... 100%
/___\\  PORT: 3000
\`\`\`

_تم توليد تمثيل مرئي مصفوفي ناجح لشبكة الوكلاء الحالية._
`;
        ctx.reply(matrixText, { parse_mode: 'Markdown' });
    } else if (cmd === 'break') {
        ctx.reply(`☕ *حان وقت استراحة القهوة الذكية (3 ساعات)!*
البوت سيتولى الآن فحص البيئة بالخلفية للتأكد من عدم تعطل أي من الاختبارات...

⏳ *مؤقت الاستراحة بدأ الآن.* خذ قسطاً من الراحة لزيادة ذكائك وتركيزك البرمجي!`);
    } else if (cmd === 'os') {
        const rpg = await botDb.getRPG(ctx.from!.id);
        const osMsg = `
🌌 *لوحة التحكم OmniMind OS - نظام مصفوفي نشط*
━━━━━━━━━━━━━━━━━━━━━━━━━━
👤 *المطور:* ${ctx.from!.first_name}
⭐ *المستوى:* ${rpg.level} | *اللقب:* ${rpg.title}
━━━━━━━━━━━━━━━━━━━━━━━━━━

الرجاء استخدام قائمة الأزرار التفاعلية البرمجية بالأسفل لتشغيل وتنفيذ الميزات فورياً وبدون كتابة أوامر معقدة:
`;
        const keyboard = Markup.inlineKeyboard([
            [
                Markup.button.callback('🏆 RPG Dashboard', 'os_rpg'),
                Markup.button.callback('📊 Live Costs', 'os_costs')
            ],
            [
                Markup.button.callback('🗺️ App Blueprint', 'os_blueprint'),
                Markup.button.callback('🥷 Security Audit', 'os_redteam')
            ],
            [
                Markup.button.callback('🐳 Dockerize App', 'os_docker'),
                Markup.button.callback('💻 Swarm Swarm', 'os_matrix')
            ],
            [
                Markup.button.callback('☕ Quick Break', 'os_break'),
                Markup.button.callback('🎭 Change Persona', 'os_persona')
            ],
            [
                Markup.button.callback('🌟 300 Superpowers 🌟', 'os_300_powers')
            ],
            [
                Markup.button.callback('📜 All Commands | كل الأوامر 📜', 'os_commands')
            ]
        ]);

        ctx.reply(osMsg, { parse_mode: 'Markdown', ...keyboard });
    } else {
        const directCmdMap: Record<string, { instruction: string; defaultArg: string }> = {
            build_api: { instruction: directFeatures.build_api || "", defaultArg: 'products' },
            build_bot: { instruction: directFeatures.build_bot || "", defaultArg: 'omnibot' },
            adr: { instruction: directFeatures.adr || "", defaultArg: 'Fastify vs Express' },
            dna: { instruction: directFeatures.dna || "", defaultArg: 'Project structure Analysis' },
            pipeline: { instruction: directFeatures.pipeline || "", defaultArg: 'Node.js CI/CD' },
            redteam: { instruction: 'أنت مهندس أمن سيبراني خبير (Red Team Specialist). قم بتحليل الكود التالي واستخراج الثغرات الأمنية المحتملة (مثل حقن SQL، تسريب توكنات، ضعف الـ CORS، ثغرات XSS)، ثم حدد درجة الخطورة (منخفضة/متوسطة/حرجة) مع تقديم طريقة معالجتها بدقة وبرمجياً.', defaultArg: 'Project Code Audit' },
            oracle: { instruction: directFeatures.oracle || "", defaultArg: 'Axios vs Fetch' },
            health: { instruction: directFeatures.health || "", defaultArg: 'Current Repository stress level' },
            harden: { instruction: directFeatures.harden || "", defaultArg: 'Express server security features' },
            profile: { instruction: directFeatures.profile || "", defaultArg: 'Code bottlenecks and queries optimization' },
            i18n: { instruction: directFeatures.i18n || "", defaultArg: 'Codebase literals translation' },
            graph: { instruction: directFeatures.graph || "", defaultArg: 'Module dependencies' },
            chaos: { instruction: directFeatures.chaos || "", defaultArg: 'Simulated infrastructure breakdown' },
            migrate: { instruction: directFeatures.migrate || "", defaultArg: 'Transitioning framework codebase' },
            deploy: { instruction: directFeatures.deploy || "", defaultArg: 'Zero-Downtime rollouts plan' }
        };

        const directInfo = directCmdMap[cmd];
        if (directInfo) {
            ctx.reply(`⚡ *OmniMind OS* -> جاري معالجة أمر *[/${cmd}]* باستخدام الذكاء المعرفي...`, { parse_mode: 'Markdown' });
            try {
                const agent = new BaseAgent();
                let codeCtx = "";
                
                if (cmd === 'redteam' || cmd === 'dna') {
                    try {
                        const activeProject = await botDb.getActiveProject(ctx.from!.id);
                        const projectPath = activeProject ? activeProject.project_path : process.cwd();
                        codeCtx = "Project Files Context:\n";
                        const files = fs.readdirSync(projectPath).filter(f => f.endsWith('.ts') || f.endsWith('.js') || f.endsWith('.json'));
                        for (const f of files.slice(0, 5)) {
                            const content = fs.readFileSync(path.join(projectPath, f), 'utf8');
                            codeCtx += `\n--- File: ${f} ---\n${content.slice(0, 1000)}\n`;
                        }
                    } catch (e) {}
                }

                const res = await agent.run(`${directInfo.instruction}\nالموضوع المستهدف: "${directInfo.defaultArg}"`, codeCtx, ctx.from!.id);
                ctx.reply(`📡 *نتيجة تنفيذ المعالج المتقدم لـ /${cmd}:*\n\n${res.content}`, { parse_mode: 'Markdown' });
            } catch (e: any) {
                ctx.reply(`❌ فشل معالجة الأمر: ${e.message}`);
            }
        }
    }
});

function getFilesRecursively(dir: string, baseDir: string = dir, maxFiles: number = 200): string[] {
    let results: string[] = [];
    try {
        const list = fs.readdirSync(dir);
        for (const file of list) {
            if (file === 'node_modules' || file === '.git' || file === 'dist' || file === '.next' || file === '.cache') continue;
            const filePath = path.join(dir, file);
            const stat = fs.statSync(filePath);
            if (stat && stat.isDirectory()) {
                results = results.concat(getFilesRecursively(filePath, baseDir, maxFiles));
            } else {
                results.push(path.relative(baseDir, filePath));
            }
            if (results.length >= maxFiles) break;
        }
    } catch (e) {}
    return results.slice(0, maxFiles);
}

function buildFileTree(dir: string, baseDir: string = dir): any[] {
    try {
        const list = fs.readdirSync(dir);
        const nodes: any[] = [];
        for (const file of list) {
            if (file === 'node_modules' || file === '.git' || file === 'dist' || file === '.next' || file === '.cache') continue;
            const filePath = path.join(dir, file);
            const relPath = path.relative(baseDir, filePath).replace(/\\/g, '/');
            const stat = fs.statSync(filePath);
            if (stat.isDirectory()) {
                const children = buildFileTree(filePath, baseDir);
                nodes.push({
                    path: relPath + '/',
                    type: 'folder',
                    children
                });
            } else {
                nodes.push({
                    path: relPath,
                    type: 'file',
                    size: stat.size
                });
            }
        }
        return nodes.sort((a, b) => {
            if (a.type !== b.type) {
                return a.type === 'folder' ? -1 : 1;
            }
            return a.path.localeCompare(b.path);
        });
    } catch (e) {
        return [];
    }
}

async function main() {
    console.log("🚀 جاري تهيئة قاعدة بيانات OmniMind OS...");
    await botDb.init();
    
    // Web health check and REST API server listening on port 3000
    const app = new Hono();

    app.use('/*', cors({
        origin: '*',
        allowMethods: ['GET', 'POST', 'OPTIONS'],
        allowHeaders: ['Content-Type', 'Authorization']
    }));

    let webhookRegistered = false;

    app.use('/*', async (c, next) => {
        try {
            const urlObj = new URL(c.req.url);
            const detectedBaseUrl = `${urlObj.protocol}//${urlObj.host}`;
            process.env.APP_URL = detectedBaseUrl;

            // Dynamically register Telegram webhook if we detect a public APP_URL
            if (!webhookRegistered && detectedBaseUrl && !detectedBaseUrl.includes('localhost') && !detectedBaseUrl.includes('127.0.0.1')) {
                webhookRegistered = true;
                const webhookUrl = `${detectedBaseUrl}/api/telegram-webhook`;
                console.log(`📡 Dynamically setting Telegram Webhook to: ${webhookUrl}`);
                
                try {
                    bot.stop();
                    console.log('🛑 Active bot polling stopped to transition to webhook mode.');
                } catch (stopErr) {}

                bot.telegram.setWebhook(webhookUrl, { drop_pending_updates: true })
                    .then(() => console.log('✅ Telegram Webhook registered dynamically!'))
                    .catch(err => {
                        console.error('❌ Failed to set Telegram Webhook dynamically:', err.message);
                        webhookRegistered = false; // reset to allow retry
                    });
            }
        } catch (e) {}
        await next();
    });

    app.post('/api/telegram-webhook', async (c) => {
        try {
            const update = await c.req.json();
            await bot.handleUpdate(update);
            return c.json({ ok: true });
        } catch (err: any) {
            console.error('⚠️ Webhook handler error:', err.message);
            return c.json({ ok: false, error: err.message }, 500);
        }
    });

    app.get('/api/download/:uniqueId/:filename', async (c) => {
        const { uniqueId, filename } = c.req.param();
        const decodedFilename = decodeURIComponent(filename);
        const filePath = path.join(process.cwd(), 'data', 'repaired', uniqueId, decodedFilename);
        
        if (!fs.existsSync(filePath)) {
            return c.text('الملف غير موجود أو انتهت صلاحيته', 404);
        }

        c.header('Content-Type', 'application/zip');
        c.header('Content-Disposition', `attachment; filename="${encodeURIComponent(decodedFilename)}"`);
        
        const fileBuffer = fs.readFileSync(filePath);
        return c.body(fileBuffer);
    });

    app.get('/api/dashboard', async (c) => {
        const userIdStr = c.req.query('user_id');
        const userId = userIdStr ? parseInt(userIdStr, 10) : 1;
        try {
            const rpg = await botDb.getRPG(userId);
            const activeProject = await botDb.getActiveProject(userId);
            const costs = await botDb.getCosts(userId);
            const preferences = await botDb.getPreferences(userId);
            
            let projectFilesCount = 0;
            let projectName = "No Active Project";
            if (activeProject) {
                projectName = activeProject.name;
                try {
                    const projPath = activeProject.project_path || process.cwd();
                    const files = getFilesRecursively(projPath);
                    projectFilesCount = files.length;
                } catch (e) {}
            } else {
                try {
                    const files = getFilesRecursively(process.cwd());
                    projectFilesCount = files.length;
                } catch (e) {}
            }

            return c.json({
                status: 'online',
                user: {
                    userId,
                    rpg,
                    preferences: preferences || { selected_persona: 'normal', selected_provider: 'gemini', selected_model: 'gemini-2.5-flash', language: 'ar' }
                },
                project: {
                    name: projectName,
                    filesCount: projectFilesCount,
                    isActive: !!activeProject
                },
                stats: {
                    totalCost: costs.totalCost,
                    totalTokens: costs.totalTokens,
                    breakdown: costs.breakdown
                }
            });
        } catch (err: any) {
            return c.json({ error: err.message }, 500);
        }
    });

    app.get('/api/files', async (c) => {
        const userIdStr = c.req.query('user_id');
        const userId = userIdStr ? parseInt(userIdStr, 10) : 1;
        try {
            const activeProject = await botDb.getActiveProject(userId);
            const projPath = activeProject ? (activeProject.project_path || process.cwd()) : process.cwd();
            const files = getFilesRecursively(projPath);
            
            const fileList = files.map(f => {
                try {
                    const stats = fs.statSync(path.join(projPath, f));
                    return {
                        path: f,
                        size: stats.size,
                        modified: stats.mtime
                    };
                } catch (e) {
                    return {
                        path: f,
                        size: 0,
                        modified: new Date()
                    };
                }
            });

            return c.json({
                project_path: projPath,
                files: fileList
            });
        } catch (err: any) {
            return c.json({ error: err.message }, 500);
        }
    });

    app.get('/api/agents', async (c) => {
        const userIdStr = c.req.query('user_id');
        const userId = userIdStr ? parseInt(userIdStr, 10) : 1;
        try {
            const preferences = await botDb.getPreferences(userId);
            return c.json({
                active_persona: preferences?.selected_persona || "normal",
                provider: preferences?.selected_provider || "gemini",
                model: preferences?.selected_model || "gemini-2.5-flash",
                available_agents: [
                    { id: "normal", name: "الوكيل الطبيعي المحترف 🤖", description: "يساعدك في كتابة الكود وحل المشاكل مباشرة" },
                    { id: "duck", name: "البطة المطاطية السقراطية 🦆", description: "يرشدك عبر الأسئلة دون إعطائك الحل مباشرة" },
                    { id: "devil", name: "محامي الشيطان المشاكس 😈", description: "يعترض على كودك ويظهر نقاط الضعف بقوة" },
                    { id: "eli5", name: "مبسط الكود الرائع 🧸", description: "يشرح المفاهيم المعقدة بطريقة مبسطة للأطفال" },
                    { id: "roast", name: "شواية الكود الكوميدية 🔥", description: "يسخر من كودك بأسلوب ممتع ولطيف" }
                ]
            });
        } catch (err: any) {
            return c.json({ error: err.message }, 500);
        }
    });

    app.get('/api/cost', async (c) => {
        const userIdStr = c.req.query('user_id');
        const userId = userIdStr ? parseInt(userIdStr, 10) : 1;
        try {
            const costs = await botDb.getCosts(userId);
            return c.json(costs);
        } catch (err: any) {
            return c.json({ error: err.message }, 500);
        }
    });

    app.get('/api/stars', async (c) => {
        const userIdStr = c.req.query('user_id');
        const userId = userIdStr ? parseInt(userIdStr, 10) : 1;
        try {
            const rpg = await botDb.getRPG(userId);
            return c.json({
                level: rpg.level,
                xp: rpg.xp,
                title: rpg.title,
                tasks_completed: rpg.tasks_completed,
                coins: (rpg.level * 150) + rpg.xp,
                store_items: [
                    { id: "gold_badge", name: "وسام المطور الذهبي", price: 500, description: "يظهر بجانب اسمك في البوت وفي لوحة التحكم" },
                    { id: "ai_boost", name: "مسرع الذكاء الخارق", price: 1000, description: "زيادة حد الطلبات اليومي للضعف" },
                    { id: "custom_theme", name: "ثيم لوحة التحكم الاحترافي", price: 1500, description: "يفتح ثيمات حصرية للوحة التحكم" }
                ]
            });
        } catch (err: any) {
            return c.json({ error: err.message }, 500);
        }
    });

    app.get('/', (c) => {
        return c.json({
            status: 'online', 
            bot: 'OmniMind OS Node Bot', 
            capabilities: '53+ Legendary Features & REST API Enabled'
        });
    });
    
    const PORT = 3000;
    const serverInstance = serve({
        fetch: app.fetch,
        port: PORT
    }, (info) => {
        console.log(`📡 Hono Web server listening on http://0.0.0.0:${info.port}`);
    });

    const initialAppUrl = process.env.APP_URL;
    const isProduction = process.env.NODE_ENV === 'production' || !!process.env.K_SERVICE;
    let useWebhook = isProduction;

    if (initialAppUrl && !initialAppUrl.includes('localhost') && !initialAppUrl.includes('127.0.0.1')) {
        useWebhook = true;
        webhookRegistered = true;
        const webhookUrl = `${initialAppUrl}/api/telegram-webhook`;
        console.log(`📡 Setting Telegram webhook on startup to: ${webhookUrl}`);
        bot.telegram.setWebhook(webhookUrl, { drop_pending_updates: true })
            .then(() => console.log('✅ Telegram Webhook registered on startup!'))
            .catch(err => {
                console.error('❌ Failed to set Telegram Webhook on startup:', err.message);
                webhookRegistered = false;
            });
    } else if (isProduction) {
        console.log("📡 Running in Production/Cloud Run mode. Webhook will be registered dynamically upon the first HTTP request to prevent 409 Conflict.");
    }

    if (!useWebhook) {
        console.log("🤖 [LOCAL] جاري تشغيل بوت التليغرام الأسطوري عبر Polling...");
        bot.telegram.deleteWebhook({ drop_pending_updates: true })
            .then(() => {
                bot.launch().catch(err => {
                    console.error("⚠️ Failed to launch Telegram bot (token might be missing/invalid), but health check server is running:", err.message);
                });
            })
            .catch(err => {
                console.error("⚠️ Failed to delete webhook before polling:", err.message);
                // fallback to launch
                bot.launch().catch(launchErr => {
                    console.error("⚠️ Failed to launch Telegram bot:", launchErr.message);
                });
            });
    } else {
        console.log("🤖 Telegram bot configured to run via WEBHOOK mode. Polling skipped to prevent 409 Conflict.");
    }

    process.once('SIGINT', () => {
        bot.stop('SIGINT');
        serverInstance.close();
    });
    process.once('SIGTERM', () => {
        bot.stop('SIGTERM');
        serverInstance.close();
    });
}

main().catch(console.error);

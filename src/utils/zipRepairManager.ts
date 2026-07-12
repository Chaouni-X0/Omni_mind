import * as fs from 'fs';
import * as path from 'path';
import axios from 'axios';
import AdmZip from 'adm-zip';
import { BaseAgent } from '../agents/BaseAgent';
import * as crypto from 'crypto';

export interface RepairProgress {
    updateMessage: (text: string) => Promise<any>;
}

export class ZipRepairManager {
    private agent: BaseAgent;
    private tempDir: string;
    private repairedDir: string;

    constructor() {
        this.agent = new BaseAgent();
        this.tempDir = path.join(process.cwd(), 'data', 'temp_zip');
        this.repairedDir = path.join(process.cwd(), 'data', 'repaired');
        
        // Ensure folders exist
        fs.mkdirSync(this.tempDir, { recursive: true });
        fs.mkdirSync(this.repairedDir, { recursive: true });
    }

    /**
     * Downloads a file from a URL to a target destination using streams
     */
    private async downloadFile(url: string, destPath: string, onProgress?: (percent: number) => void): Promise<void> {
        const response = await axios({
            method: 'get',
            url: url,
            responseType: 'stream',
            timeout: 120000 // 2 minutes timeout for large files
        });

        const contentLengthHeader = response.headers['content-length'];
        const totalLength = contentLengthHeader ? parseInt(String(contentLengthHeader), 10) : 0;
        let downloadedLength = 0;

        const writer = fs.createWriteStream(destPath);
        response.data.pipe(writer);

        return new Promise((resolve, reject) => {
            response.data.on('data', (chunk: any) => {
                downloadedLength += chunk.length;
                if (totalLength > 0 && onProgress) {
                    const percent = Math.round((downloadedLength / totalLength) * 100);
                    onProgress(percent);
                }
            });

            writer.on('finish', resolve);
            writer.on('error', (err) => {
                writer.close();
                reject(err);
            });
        });
    }

    /**
     * Recursively lists all text-based code files in a folder, filtering out bulky non-code files
     */
    private scanFiles(dir: string, baseDir: string = dir): { relativePath: string; fullPath: string; size: number }[] {
        let results: any[] = [];
        const items = fs.readdirSync(dir);

        // Directories to strictly skip to avoid freezing on huge assets
        const skipDirs = new Set([
            'node_modules', '.git', 'dist', 'build', '.next', '.cache', 'out', 
            '__pycache__', 'venv', 'env', '.expo', 'ios', 'android', 'bin', 'obj'
        ]);

        // Code extensions we are interested in analyzing/modifying
        const codeExtensions = new Set([
            '.ts', '.tsx', '.js', '.jsx', '.py', '.java', '.c', '.cpp', '.h', 
            '.cs', '.html', '.css', '.json', '.md', '.yml', '.yaml', '.sh', 
            '.php', '.rb', '.go', '.rs', '.swift', '.sql', '.toml', '.xml'
        ]);

        for (const item of items) {
            const fullPath = path.join(dir, item);
            const stat = fs.statSync(fullPath);

            if (stat.isDirectory()) {
                if (skipDirs.has(item)) continue;
                results = results.concat(this.scanFiles(fullPath, baseDir));
            } else {
                const ext = path.extname(item).toLowerCase();
                // Skip files larger than 1.5MB to prevent prompt overflow or memory exhaustion
                if (codeExtensions.has(ext) && stat.size < 1500000) {
                    results.push({
                        relativePath: path.relative(baseDir, fullPath).replace(/\\/g, '/'),
                        fullPath,
                        size: stat.size
                    });
                }
            }
        }

        return results;
    }

    /**
     * Main handler to process the ZIP file download, extraction, repair, and repackaging
     */
    public async processZipRepair(
        sourceUrl: string, 
        userInstructions: string, 
        userId: number, 
        originalFilename: string,
        progress?: RepairProgress
    ): Promise<{ downloadUrl: string; localPath: string; filesChanged: string[]; analysis: string }> {
        const uniqueId = crypto.randomBytes(8).toString('hex');
        const sessionDownloadPath = path.join(this.tempDir, `download_${uniqueId}.zip`);
        const sessionExtractPath = path.join(this.tempDir, `extract_${uniqueId}`);
        const sessionRepairedPath = path.join(this.repairedDir, uniqueId);

        fs.mkdirSync(sessionExtractPath, { recursive: true });
        fs.mkdirSync(sessionRepairedPath, { recursive: true });

        try {
            // Step 1: Download
            if (progress) {
                await progress.updateMessage(`📥 <b>[1/5] جاري تحميل ملف الـ ZIP...</b>\nالمصدر: <code>${originalFilename}</code>\nيرجى الانتظار، قد يستغرق هذا بعض الوقت للمشاريع الكبيرة...`);
            }

            await this.downloadFile(sourceUrl, sessionDownloadPath, async (percent) => {
                if (progress && percent % 25 === 0) {
                    await progress.updateMessage(`📥 <b>[1/5] جاري تحميل ملف الـ ZIP... (${percent}%)</b>`).catch(() => {});
                }
            });

            // Step 2: Extract
            if (progress) {
                await progress.updateMessage(`📂 <b>[2/5] جاري تفكيك الضغط وقراءة البنية الهيكلية للمشروع...</b>`);
            }

            const zip = new AdmZip(sessionDownloadPath);
            zip.extractAllTo(sessionExtractPath, true);

            // Scan files
            const filesList = this.scanFiles(sessionExtractPath);
            if (filesList.length === 0) {
                throw new Error("لم نجد أي ملفات برمجية قابلة للتعديل داخل ملف الـ ZIP المرفوع. يرجى التأكد من احتوائه على ملفات كود مصدري.");
            }

            // Step 3: Analyze structure via Gemini
            if (progress) {
                await progress.updateMessage(`🧠 <b>[3/5] جاري تحليل كود المشروع واكتشاف المشاكل المطلوبة...</b>\nتم العثور على <code>${filesList.length}</code> ملف برمجياً.`);
            }

            // Format tree structure for Gemini
            const fileTreeText = filesList.map(f => `- ${f.relativePath} (${(f.size / 1024).toFixed(1)} KB)`).join('\n');
            const analysisSystemPrompt = `You are an expert system-wide software code repair assistant.
Analyze the files list and the user's instructions. Identify EXACTLY which files are key and must be modified or created to fulfill the user's task.
You MUST output your response in STRICT valid JSON format like this:
{
  "analysis": "A brief analysis of what needs to be fixed and changed in Arabic.",
  "files_to_modify": ["relative/path/to/file1.ts", "relative/path/to/file2.js"],
  "files_to_create": ["relative/path/to/newfile.md"]
}
Do NOT include any markdown code blocks or additional text. Just output pure JSON.`;

            const analysisPrompt = `User Instructions:\n"${userInstructions}"\n\nProject Code Files:\n${fileTreeText}`;
            
            const analysisResultRaw = await this.agent.runCustom(analysisSystemPrompt, analysisPrompt, userId);
            
            // Clean JSON string
            let jsonString = analysisResultRaw.trim();
            if (jsonString.startsWith('```json')) {
                jsonString = jsonString.slice(7);
            }
            if (jsonString.endsWith('```')) {
                jsonString = jsonString.slice(0, -3);
            }
            jsonString = jsonString.trim();

            let analysisData: { analysis: string; files_to_modify: string[]; files_to_create: string[] };
            try {
                analysisData = JSON.parse(jsonString);
            } catch (e) {
                // Failover parser
                console.error("Failed to parse analysis JSON:", jsonString);
                analysisData = {
                    analysis: "جاري بدء الإصلاح والتحديث العام لملفات المشروع...",
                    files_to_modify: filesList.slice(0, 3).map(f => f.relativePath), // default to first 3 files
                    files_to_create: []
                };
            }

            // Step 4: Execute repairs
            const filesChanged: string[] = [];
            const totalTasks = analysisData.files_to_modify.length + analysisData.files_to_create.length;
            let currentTaskNum = 0;

            if (progress) {
                await progress.updateMessage(`🛠️ <b>[4/5] جاري بدء عمليات تعديل وإصلاح الملفات المستهدفة...</b>\nالخطة المقترحة:\n${analysisData.analysis}`);
            }

            // Handle modifying existing files
            for (const relPath of analysisData.files_to_modify) {
                currentTaskNum++;
                const targetFile = filesList.find(f => f.relativePath.toLowerCase() === relPath.toLowerCase());
                if (!targetFile) continue;

                if (progress) {
                    await progress.updateMessage(`🛠️ <b>[4/5] جاري تعديل الملف (${currentTaskNum}/${totalTasks}):</b>\n<code>${relPath}</code>`);
                }

                try {
                    const originalContent = fs.readFileSync(targetFile.fullPath, 'utf8');
                    const repairSystemPrompt = `You are a surgical file-editing assistant.
You will be given the full content of a file and user's instruction.
Your goal is to output the final complete, modified content of the file that correctly implements the user's instructions.
DO NOT wrap your response in markdown code blocks or add any comments unless they are part of the file itself. Output ONLY the raw content of the modified file. No explanations, no markdown blocks.`;

                    const repairPrompt = `File Path: ${relPath}\n\nUser Goal:\n${userInstructions}\n\nOriginal Content:\n${originalContent}`;
                    const modifiedContent = await this.agent.runCustom(repairSystemPrompt, repairPrompt, userId);
                    
                    let cleanedContent = modifiedContent.trim();
                    const codeBlockMatch = cleanedContent.match(/^```[a-zA-Z]*\r?\n([\s\S]*?)\r?\n```$/);
                    if (codeBlockMatch) {
                        cleanedContent = codeBlockMatch[1] || '';
                    } else {
                        cleanedContent = cleanedContent.replace(/^```[a-zA-Z]*\r?\n/, '').replace(/\r?\n```$/, '');
                    }

                    fs.writeFileSync(targetFile.fullPath, cleanedContent, 'utf8');
                    filesChanged.push(relPath);
                } catch (err: any) {
                    console.error(`Failed to repair file ${relPath}:`, err);
                }
            }

            // Handle creating new files
            for (const relPath of analysisData.files_to_create) {
                currentTaskNum++;
                const fullPath = path.join(sessionExtractPath, relPath);
                
                if (progress) {
                    await progress.updateMessage(`🛠️ <b>[4/5] جاري إنشاء ملف جديد (${currentTaskNum}/${totalTasks}):</b>\n<code>${relPath}</code>`);
                }

                try {
                    // Ensure subdirectory exists
                    fs.mkdirSync(path.dirname(fullPath), { recursive: true });

                    const createSystemPrompt = `You are a professional software engineer.
Generate the ideal file contents for a new file to be created.
The content must perfectly align with the user's instruction and the architecture.
DO NOT wrap your response in markdown code blocks. Output ONLY the raw contents of the file.`;

                    const createPrompt = `File to create: ${relPath}\n\nUser Goal:\n${userInstructions}`;
                    const generatedContent = await this.agent.runCustom(createSystemPrompt, createPrompt, userId);

                    let cleanedContent = generatedContent.trim();
                    const codeBlockMatch = cleanedContent.match(/^```[a-zA-Z]*\r?\n([\s\S]*?)\r?\n```$/);
                    if (codeBlockMatch) {
                        cleanedContent = codeBlockMatch[1] || '';
                    } else {
                        cleanedContent = cleanedContent.replace(/^```[a-zA-Z]*\r?\n/, '').replace(/\r?\n```$/, '');
                    }

                    fs.writeFileSync(fullPath, cleanedContent, 'utf8');
                    filesChanged.push(relPath);
                } catch (err: any) {
                    console.error(`Failed to create file ${relPath}:`, err);
                }
            }

            // Step 5: Repackage ZIP
            if (progress) {
                await progress.updateMessage(`📦 <b>[5/5] جاري إعادة ضغط ملفات المشروع النهائي...</b>`);
            }

            const cleanedName = originalFilename.replace(/\.zip$/i, '') + '_repaired.zip';
            const outputZipPath = path.join(sessionRepairedPath, cleanedName);

            const repairedZip = new AdmZip();
            repairedZip.addLocalFolder(sessionExtractPath);
            repairedZip.writeZip(outputZipPath);

            // Construct secure download link (rely on dynamic host resolver or standard fallback)
            const appBaseUrl = process.env.APP_URL || 'https://ais-dev-tijjoot5llliixiops7qv6-673141320928.europe-west2.run.app';
            const downloadUrl = `${appBaseUrl}/api/download/${uniqueId}/${encodeURIComponent(cleanedName)}`;

            if (progress) {
                await progress.updateMessage(`✅ <b>تم الانتهاء بنجاح من إصلاح مشروعك وتغليفه!</b>`);
            }

            return {
                downloadUrl,
                localPath: outputZipPath,
                filesChanged,
                analysis: analysisData.analysis
            };

        } finally {
            // Clean up temporary downloaded file and extracted directory to preserve disk space
            try {
                if (fs.existsSync(sessionDownloadPath)) {
                    fs.unlinkSync(sessionDownloadPath);
                }
                if (fs.existsSync(sessionExtractPath)) {
                    fs.rmSync(sessionExtractPath, { recursive: true, force: true });
                }
            } catch (cleanupErr) {
                console.error("Failed to clean up temp ZIP files:", cleanupErr);
            }
        }
    }
}

export const zipRepairManager = new ZipRepairManager();

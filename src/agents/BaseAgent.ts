import axios from 'axios';
import { GoogleGenAI } from '@google/genai';
import { botDb } from '../db/botDb';
import { decrypt } from '../vault/crypto';
import { executeShell, gitOperation, webResearch } from '../utils/toolExecutor';

export interface AgentResult {
    name: string;
    content: string;
}

const MODEL_PRICING: Record<string, { input: number; output: number }> = {
    "gpt-4o-mini": { input: 0.15 / 1000000, output: 0.60 / 1000000 },
    "gpt-4o": { input: 2.50 / 1000000, output: 10.00 / 1000000 },
    "gemini-2.5-flash": { input: 0.075 / 1000000, output: 0.30 / 1000000 },
    "gemini-2.5-pro": { input: 1.25 / 1000000, output: 5.00 / 1000000 },
    "claude-3-haiku": { input: 0.25 / 1000000, output: 1.25 / 1000000 },
    "claude-3-5-sonnet": { input: 3.00 / 1000000, output: 15.00 / 1000000 },
};

export class BaseAgent {
    name: string = "base";
    systemPrompt: string = "You are a helpful software engineering agent.";

    async run(task: string, codeContext: string, userId: number, prior?: Record<string, string>, projectPath?: string): Promise<AgentResult> {
        const prefs = await botDb.getPreferences(userId);
        const lang = prefs?.language || "ar";
        const selectedPersona = prefs?.selected_persona || "normal";

        // Dynamic Persona adjustment
        let activeSystemPrompt = this.systemPrompt;
        if (selectedPersona === "duck") {
            activeSystemPrompt = "You are an interactive software Rubber Duck. You must NOT write any direct code solutions! Instead, ask deep, Socratic questions that guide the developer to find the solution themselves. Use friendly quacks occasionally like 'Quack! 🦆' and speak in a helpful, warm, Socratic tone.";
        } else if (selectedPersona === "devil") {
            activeSystemPrompt = "You are the Devil's Advocate for software engineering. You must argue against the developer's architectural or coding decisions. Ask challenging questions, highlight potential failure points, point out performance risks, and force them to justify their implementation choices with solid logic.";
        } else if (selectedPersona === "eli5") {
            activeSystemPrompt = "You are a simple and patient teacher who explains complex code concepts as if the user is 5 years old. Use analogies, toys, playground examples, and keep code examples extremely small and simple.";
        } else if (selectedPersona === "roast") {
            activeSystemPrompt = "You are a savage, funny software engineering stand-up comedian. Roast the developer's code, bugs, or errors with hilarious, dramatic, eye-opening programmer humor. Be savage but lighthearted. Keep it extremely entertaining and witty!";
        }

        const toolsDesc = `
        يمكنك استخدام الأدوات التالية عبر كتابة [TOOL: name, arg1]:
        - SHELL: تنفيذ أمر في الترمنال (مثال: [TOOL: SHELL, ls -l])
        - GIT: عمليات غيت (status, add, commit, push, pull)
        - RESEARCH: بحث في الويب
        `;

        const prompt = this.composePrompt(activeSystemPrompt, task, codeContext, prior || {}, lang, toolsDesc);
        
        // Smart routing to decide model
        const { provider, model } = this.smartRoute(task, prompt, prefs);

        // Get AI Response using Token Pool + Failover rotation
        const content = await this.callUserAiWithFailover(userId, provider, model, prompt, activeSystemPrompt);

        // Process any tool execution requested by AI
        const processedContent = await this.handleTools(content, projectPath, userId);

        // Add RPG XP for running an agent task
        await botDb.addXP(userId, 15, true);

        return { name: this.name, content: processedContent };
    }

    async runCustom(systemPrompt: string, prompt: string, userId: number): Promise<string> {
        const prefs = await botDb.getPreferences(userId);
        const { provider, model } = this.smartRoute(prompt, prompt, prefs);
        return await this.callUserAiWithFailover(userId, provider, model, prompt, systemPrompt);
    }

    private composePrompt(systemPrompt: string, task: string, codeContext: string, prior: Record<string, string>, lang: string, toolsDesc: string): string {
        const priorText = Object.entries(prior).map(([k, v]) => `[${k}] ${v}`).join('\n');
        const langInstruction = lang === "ar" ? "Respond in concise Arabic unless code is needed." : "Respond in concise English unless code is needed.";
        return `${systemPrompt}\n\nTask:\n${task}\n\nCurrent code context:\n${codeContext || '[empty project]'}\n\nPrior agent notes:\n${priorText || '[none]'}\n\n${langInstruction} ${toolsDesc}\nIf proposing code, include the final full replacement content inside a \`\`\`text block when possible.`;
    }

    private smartRoute(task: string, prompt: string, prefs: any): { provider: string; model: string } {
        // Default values
        let provider = prefs?.selected_provider || "gemini";
        let model = prefs?.selected_model;

        if (model) {
            return { provider, model };
        }

        // Smart selection based on complexity
        const complexityKeywords = ["architecture", "secure", "build", "refactor", "bug", "optimize", "db", "docker", "pipeline"];
        const isComplex = complexityKeywords.some(keyword => task.toLowerCase().includes(keyword)) || prompt.length > 2000;

        if (provider === "openai") {
            model = isComplex ? "gpt-4o" : "gpt-4o-mini";
        } else if (provider === "gemini") {
            model = isComplex ? "gemini-2.5-pro" : "gemini-2.5-flash";
        } else if (provider === "openrouter") {
            model = isComplex ? "openai/gpt-4o" : "openai/gpt-4o-mini";
        } else if (provider === "anthropic") {
            model = isComplex ? "claude-3-5-sonnet" : "claude-3-haiku";
        } else {
            // Default to Gemini
            provider = "gemini";
            model = isComplex ? "gemini-2.5-pro" : "gemini-2.5-flash";
        }

        return { provider, model };
    }

    private async callUserAiWithFailover(userId: number, initialProvider: string, initialModel: string, prompt: string, systemPrompt: string): Promise<string> {
        const providersOrder = [initialProvider, "gemini", "openai", "openrouter", "anthropic"];
        // Ensure no duplicates
        const uniqueProviders = Array.from(new Set(providersOrder));

        let lastError: any = null;

        for (const provider of uniqueProviders) {
            try {
                // Try fetching keys from token pool first
                const poolTokens = await botDb.getPoolTokens(userId, provider);
                if (poolTokens.length > 0) {
                    // Rotate through pool tokens
                    for (const poolToken of poolTokens) {
                        try {
                            const key = decrypt(poolToken.encrypted_value, userId);
                            const model = provider === initialProvider ? initialModel : this.getDefaultModel(provider);
                            const result = await this.dispatch(provider, key, prompt, systemPrompt, model, userId);
                            return result;
                        } catch (err: any) {
                            lastError = err;
                            // Report rate limit / failure
                            await botDb.reportRateLimit(poolToken.id);
                        }
                    }
                }

                // If no pool token worked or none found, try standard credential
                const row = await botDb.getCredential(userId, provider);
                if (row) {
                    const key = decrypt(row.encrypted_value, userId);
                    const model = provider === initialProvider ? initialModel : this.getDefaultModel(provider);
                    const result = await this.dispatch(provider, key, prompt, systemPrompt, model, userId);
                    return result;
                }

                // Special Fallback: If provider is Gemini and there is a system-wide GEMINI_API_KEY, use it!
                if (provider === "gemini" && process.env.GEMINI_API_KEY) {
                    const model = provider === initialProvider ? initialModel : "gemini-2.5-flash";
                    const result = await this.dispatch(provider, process.env.GEMINI_API_KEY, prompt, systemPrompt, model, userId);
                    return result;
                }

            } catch (err: any) {
                lastError = err;
            }
        }

        throw new Error(`All providers failed. Last error: ${lastError?.message || "No configured provider"}`);
    }

    private getDefaultModel(provider: string): string {
        if (provider === "openai") return "gpt-4o-mini";
        if (provider === "gemini") return "gemini-2.5-flash";
        if (provider === "anthropic") return "claude-3-haiku";
        return "openai/gpt-4o-mini";
    }

    private async dispatch(provider: string, key: string, prompt: string, systemPrompt: string, model: string, userId: number): Promise<string> {
        let responseContent = "";
        const startTime = Date.now();

        if (provider === "openai") {
            responseContent = await this.callOpenAI(key, prompt, systemPrompt, "https://api.openai.com/v1/chat/completions", model);
        } else if (provider === "openrouter") {
            responseContent = await this.callOpenAI(key, prompt, systemPrompt, "https://openrouter.ai/api/v1/chat/completions", model);
        } else if (provider === "gemini") {
            responseContent = await this.callGeminiSDK(key, prompt, systemPrompt, model);
        } else {
            throw new Error(`Provider ${provider} is not fully supported yet.`);
        }

        // Log cost dynamically
        try {
            const promptTokens = Math.ceil(prompt.length / 4);
            const responseTokens = Math.ceil(responseContent.length / 4);
            const totalTokens = promptTokens + responseTokens;
            const rates = MODEL_PRICING[model] || { input: 0.1 / 1000000, output: 0.4 / 1000000 };
            const estimatedCost = (promptTokens * rates.input) + (responseTokens * rates.output);

            await botDb.logCost(userId, model, totalTokens, estimatedCost);
        } catch (e) {
            console.error("Failed to log cost:", e);
        }

        return responseContent;
    }

    private async callOpenAI(key: string, prompt: string, systemPrompt: string, url: string, model: string): Promise<string> {
        const payload = {
            model,
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: prompt }
            ],
            temperature: 0.2
        };
        const headers = { Authorization: `Bearer ${key}`, "Content-Type": "application/json" };

        try {
            const response = await axios.post(url, payload, { headers, timeout: 60000 });
            return response.data.choices[0].message.content;
        } catch (error: any) {
            throw new Error(`AI provider error: ${error.response?.data?.error?.message || error.message}`);
        }
    }

    private async callGeminiSDK(key: string, prompt: string, systemPrompt: string, model: string): Promise<string> {
        try {
            const ai = new GoogleGenAI({
                apiKey: key,
                httpOptions: {
                    headers: {
                        'User-Agent': 'aistudio-build',
                    }
                }
            });
            const response = await ai.models.generateContent({
                model: model,
                contents: prompt,
                config: {
                    systemInstruction: systemPrompt,
                    temperature: 0.2,
                }
            });
            if (!response.text) {
                throw new Error("Empty response received from Gemini API");
            }
            return response.text;
        } catch (error: any) {
            throw new Error(`Gemini SDK error: ${error.message}`);
        }
    }

    private async handleTools(content: string, projectPath: string | undefined, userId: number): Promise<string> {
        const toolPattern = /\[TOOL:\s*(\w+),\s*(.*?)\]/g;
        let matches = [...content.matchAll(toolPattern)];

        if (matches.length === 0) return content;

        const toolResults: string[] = [];
        for (const match of matches) {
            const toolName = (match[1] || "").toUpperCase();
            const args = match[2] || "";

            if (toolName === "SHELL") {
                const res = await executeShell(args, projectPath);
                toolResults.push(`SHELL Result: ${res.stdout || res.stderr}`);
            } else if (toolName === "GIT") {
                const tokenRow = await botDb.getCredential(userId, "github_token");
                const token = tokenRow ? decrypt(tokenRow.encrypted_value, userId) : undefined;
                const res = await gitOperation(args, projectPath || '', token);
                toolResults.push(`GIT Result: ${res.stdout || res.stderr}`);
            } else if (toolName === "RESEARCH") {
                const res = webResearch(args);
                toolResults.push(`RESEARCH Result: ${res}`);
            }
        }

        return `${content}\n\n--- Tool Execution Results ---\n${toolResults.join('\n')}`;
    }
}

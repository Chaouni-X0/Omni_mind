import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export interface ToolResult {
    stdout: string;
    stderr: string;
    exitCode: number;
    success: boolean;
}

export async function executeShell(command: string, cwd?: string): Promise<ToolResult> {
    try {
        const { stdout, stderr } = await execAsync(command, { cwd: cwd || process.cwd(), timeout: 30000 });
        return {
            stdout: stdout.trim(),
            stderr: stderr.trim(),
            exitCode: 0,
            success: true
        };
    } catch (error: any) {
        return {
            stdout: error.stdout?.trim() || '',
            stderr: error.stderr?.trim() || error.message,
            exitCode: error.code || -1,
            success: false
        };
    }
}

export async function gitOperation(operation: string, projectPath: string, token?: string): Promise<ToolResult> {
    const commands: Record<string, string> = {
        status: 'git status',
        add: 'git add .',
        commit: 'git commit -m "OmniMind Auto Commit"',
        push: 'git push',
        pull: 'git pull'
    };

    const cmd = commands[operation];
    if (!cmd) {
        return { success: false, stdout: '', stderr: 'Operation not supported', exitCode: -1 };
    }

    return await executeShell(cmd, projectPath);
}

export function webResearch(query: string): string {
    return `نتائج البحث عن '${query}': [هذه ميزة تجريبية، سيتم ربطها بـ API البحث في التحديث القادم]`;
}

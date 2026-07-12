import sqlite3 from 'sqlite3';
import { open, Database } from 'sqlite';
import * as path from 'path';

export class BotDB {
    private db: Database | null = null;
    private dbPath: string;

    constructor() {
        this.dbPath = path.join(process.cwd(), 'bot.db');
    }

    async init() {
        this.db = await open({
            filename: this.dbPath,
            driver: sqlite3.Database
        });

        await this.db.exec(`
            CREATE TABLE IF NOT EXISTS users (
                user_id INTEGER PRIMARY KEY,
                username TEXT,
                joined_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS credentials (
                user_id INTEGER,
                key_name TEXT,
                encrypted_value TEXT,
                PRIMARY KEY (user_id, key_name),
                FOREIGN KEY (user_id) REFERENCES users(user_id)
            );

            CREATE TABLE IF NOT EXISTS projects (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER,
                name TEXT,
                project_path TEXT,
                is_active BOOLEAN DEFAULT 0,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(user_id)
            );

            CREATE TABLE IF NOT EXISTS preferences (
                user_id INTEGER PRIMARY KEY,
                selected_provider TEXT,
                selected_model TEXT,
                language TEXT DEFAULT 'ar',
                selected_persona TEXT DEFAULT 'normal',
                FOREIGN KEY (user_id) REFERENCES users(user_id)
            );

            CREATE TABLE IF NOT EXISTS team_members (
                project_id INTEGER,
                user_id INTEGER,
                role TEXT DEFAULT 'member',
                PRIMARY KEY (project_id, user_id),
                FOREIGN KEY (project_id) REFERENCES projects(id),
                FOREIGN KEY (user_id) REFERENCES users(user_id)
            );

            CREATE TABLE IF NOT EXISTS secrets (
                project_id INTEGER,
                secret_name TEXT,
                encrypted_value TEXT,
                environment TEXT DEFAULT 'dev',
                PRIMARY KEY (project_id, secret_name, environment),
                FOREIGN KEY (project_id) REFERENCES projects(id)
            );

            CREATE TABLE IF NOT EXISTS token_pool (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER,
                provider TEXT,
                encrypted_value TEXT,
                is_active INTEGER DEFAULT 1,
                rate_limit_hits INTEGER DEFAULT 0,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS user_rpg (
                user_id INTEGER PRIMARY KEY,
                xp INTEGER DEFAULT 0,
                level INTEGER DEFAULT 1,
                title TEXT DEFAULT 'Junior Ninja',
                tasks_completed INTEGER DEFAULT 0,
                FOREIGN KEY (user_id) REFERENCES users(user_id)
            );

            CREATE TABLE IF NOT EXISTS cost_logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER,
                model TEXT,
                tokens_used INTEGER,
                estimated_cost REAL,
                logged_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS file_locks (
                project_id INTEGER,
                file_path TEXT,
                locked_by INTEGER,
                locked_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (project_id, file_path)
            );
        `);

        // Safely alter table to add selected_persona if it didn't exist in older installations
        try {
            await this.db.exec("ALTER TABLE preferences ADD COLUMN selected_persona TEXT DEFAULT 'normal'");
        } catch (e) {
            // Ignore if column already exists
        }
    }

    async ensureUser(userId: number, username?: string) {
        await this.db?.run(
            'INSERT OR IGNORE INTO users (user_id, username) VALUES (?, ?)',
            [userId, username || null]
        );
    }

    async addCredential(userId: number, keyName: string, encryptedValue: string) {
        await this.db?.run(
            'INSERT OR REPLACE INTO credentials (user_id, key_name, encrypted_value) VALUES (?, ?, ?)',
            [userId, keyName.toLowerCase(), encryptedValue]
        );
    }

    async getCredential(userId: number, keyName: string) {
        return await this.db?.get(
            'SELECT * FROM credentials WHERE user_id = ? AND key_name = ?',
            [userId, keyName.toLowerCase()]
        );
    }

    async createProject(userId: number, name: string, projectPath: string) {
        await this.db?.run('UPDATE projects SET is_active = 0 WHERE user_id = ?', [userId]);
        await this.db?.run(
            'INSERT INTO projects (user_id, name, project_path, is_active) VALUES (?, ?, ?, 1)',
            [userId, name, projectPath]
        );
    }

    async getActiveProject(userId: number) {
        return await this.db?.get(
            'SELECT * FROM projects WHERE user_id = ? AND is_active = 1',
            [userId]
        );
    }

    async getPreferences(userId: number) {
        return await this.db?.get('SELECT * FROM preferences WHERE user_id = ?', [userId]);
    }

    async setPreferences(userId: number, provider?: string, model?: string, lang?: string, persona?: string) {
        const current = await this.getPreferences(userId);
        if (!current) {
            await this.db?.run(
                'INSERT INTO preferences (user_id, selected_provider, selected_model, language, selected_persona) VALUES (?, ?, ?, ?, ?)',
                [userId, provider || null, model || null, lang || 'ar', persona || 'normal']
            );
        } else {
            if (provider) await this.db?.run('UPDATE preferences SET selected_provider = ? WHERE user_id = ?', [provider, userId]);
            if (model) await this.db?.run('UPDATE preferences SET selected_model = ? WHERE user_id = ?', [model, userId]);
            if (lang) await this.db?.run('UPDATE preferences SET language = ? WHERE user_id = ?', [lang, userId]);
            if (persona) await this.db?.run('UPDATE preferences SET selected_persona = ? WHERE user_id = ?', [persona, userId]);
        }
    }

    async setPersona(userId: number, persona: string) {
        await this.setPreferences(userId, undefined, undefined, undefined, persona);
    }

    // RPG Gamification System
    async getRPG(userId: number) {
        let rpg = await this.db?.get('SELECT * FROM user_rpg WHERE user_id = ?', [userId]);
        if (!rpg) {
            await this.db?.run(
                'INSERT INTO user_rpg (user_id, xp, level, title, tasks_completed) VALUES (?, 0, 1, "Junior Ninja", 0)',
                [userId]
            );
            rpg = { user_id: userId, xp: 0, level: 1, title: 'Junior Ninja', tasks_completed: 0 };
        }
        return rpg;
    }

    async addXP(userId: number, xpAmount: number, taskCompleted: boolean = false) {
        const rpg = await this.getRPG(userId);
        let newXp = (rpg.xp || 0) + xpAmount;
        let level = rpg.level || 1;
        let tasksCompleted = (rpg.tasks_completed || 0) + (taskCompleted ? 1 : 0);
        let leveledUp = false;

        while (newXp >= level * 100) {
            newXp -= level * 100;
            level++;
            leveledUp = true;
        }

        let title = 'Junior Ninja';
        if (level >= 26) title = 'OmniMind Guru 🌌';
        else if (level >= 19) title = 'Software Architect 🏛️';
        else if (level >= 13) title = 'Senior Wizard 🧙‍♂️';
        else if (level >= 8) title = 'Senior Ninja 🥷';
        else if (level >= 4) title = 'Junior Wizard 🧙‍♂️';

        await this.db?.run(
            'UPDATE user_rpg SET xp = ?, level = ?, title = ?, tasks_completed = ? WHERE user_id = ?',
            [newXp, level, title, tasksCompleted, userId]
        );

        return {
            leveledUp,
            xp: newXp,
            level,
            title,
            tasksCompleted
        };
    }

    // Token Pool Manager
    async addPoolToken(userId: number, provider: string, encryptedValue: string) {
        await this.db?.run(
            'INSERT INTO token_pool (user_id, provider, encrypted_value, is_active) VALUES (?, ?, ?, 1)',
            [userId, provider.toLowerCase(), encryptedValue]
        );
    }

    async getPoolTokens(userId: number, provider: string) {
        return await this.db?.all(
            'SELECT * FROM token_pool WHERE user_id = ? AND provider = ? AND is_active = 1',
            [userId, provider.toLowerCase()]
        ) || [];
    }

    async reportRateLimit(tokenId: number) {
        await this.db?.run(
            'UPDATE token_pool SET rate_limit_hits = rate_limit_hits + 1 WHERE id = ?',
            [tokenId]
        );
    }

    // Cost Logging & Dashboard
    async logCost(userId: number, model: string, tokensUsed: number, estimatedCost: number) {
        await this.db?.run(
            'INSERT INTO cost_logs (user_id, model, tokens_used, estimated_cost) VALUES (?, ?, ?, ?)',
            [userId, model, tokensUsed, estimatedCost]
        );
    }

    async getCosts(userId: number) {
        const rows = await this.db?.all(
            'SELECT model, SUM(tokens_used) as total_tokens, SUM(estimated_cost) as total_cost, COUNT(id) as request_count FROM cost_logs WHERE user_id = ? GROUP BY model',
            [userId]
        ) || [];
        const total = await this.db?.get(
            'SELECT SUM(tokens_used) as total_tokens, SUM(estimated_cost) as total_cost FROM cost_logs WHERE user_id = ?',
            [userId]
        );
        return {
            breakdown: rows,
            totalTokens: total?.total_tokens || 0,
            totalCost: total?.total_cost || 0
        };
    }

    // File Locking System
    async lockFile(projectId: number, filePath: string, userId: number) {
        const currentLock = await this.getFileLock(projectId, filePath);
        if (currentLock && currentLock.locked_by !== userId) {
            return false;
        }
        await this.db?.run(
            'INSERT OR REPLACE INTO file_locks (project_id, file_path, locked_by) VALUES (?, ?, ?)',
            [projectId, filePath, userId]
        );
        return true;
    }

    async unlockFile(projectId: number, filePath: string) {
        await this.db?.run(
            'DELETE FROM file_locks WHERE project_id = ? AND file_path = ?',
            [projectId, filePath]
        );
    }

    async getFileLock(projectId: number, filePath: string) {
        return await this.db?.get(
            'SELECT * FROM file_locks WHERE project_id = ? AND file_path = ?',
            [projectId, filePath]
        );
    }

    // Enterprise methods
    async addTeamMember(projectId: number, userId: number, role: string = 'member') {
        await this.ensureUser(userId);
        await this.db?.run(
            'INSERT OR REPLACE INTO team_members (project_id, user_id, role) VALUES (?, ?, ?)',
            [projectId, userId, role]
        );
    }

    async getTeamMembers(projectId: number) {
        return await this.db?.all('SELECT * FROM team_members WHERE project_id = ?', [projectId]);
    }

    async addSecret(projectId: number, name: string, encryptedValue: string, env: string = 'dev') {
        await this.db?.run(
            `INSERT INTO secrets (project_id, secret_name, encrypted_value, environment) VALUES (?, ?, ?, ?)
             ON CONFLICT(project_id, secret_name, environment) DO UPDATE SET encrypted_value = excluded.encrypted_value`,
            [projectId, name, encryptedValue, env]
        );
    }

    async listSecrets(projectId: number, env: string = 'dev') {
        return await this.db?.all(
            'SELECT secret_name FROM secrets WHERE project_id = ? AND environment = ?',
            [projectId, env]
        );
    }
}

export const botDb = new BotDB();

import * as crypto from 'crypto';
import * as dotenv from 'dotenv';

dotenv.config();

function getPepper(): string {
    const pepper = process.env.VAULT_PEPPER;
    if (!pepper) {
        return "omnimind_default_fallback_pepper_key_2026";
    }
    return pepper;
}

function deriveKey(userId: number): Buffer {
    const pepper = getPepper();
    const secret = `${pepper}_${userId}`;
    // Generate a 32-byte key using SHA-256
    return crypto.createHash('sha256').update(secret).digest();
}

export function encrypt(text: string, userId: number): string {
    const key = deriveKey(userId);
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
    
    let encrypted = cipher.update(text, 'utf8', 'base64');
    encrypted += cipher.final('base64');
    
    // Return iv and encrypted data separated by colon
    return `${iv.toString('base64')}:${encrypted}`;
}

export function decrypt(encryptedText: string, userId: number): string {
    const key = deriveKey(userId);
    const [ivBase64, encrypted] = encryptedText.split(':');
    
    if (!ivBase64 || !encrypted) {
        throw new Error("Invalid encrypted text format");
    }
    
    const iv = Buffer.from(ivBase64, 'base64');
    
    const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
    
    let decrypted = decipher.update(encrypted as string, 'base64', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
}

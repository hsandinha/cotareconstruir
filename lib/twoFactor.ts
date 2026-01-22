/**
 * Sistema de Autenticação 2FA (Two-Factor Authentication)
 * Usa TOTP (Time-based One-Time Password)
 */

import speakeasy from 'speakeasy';
import QRCode from 'qrcode';

/**
 * Gerar segredo 2FA para novo usuário
 */
export function generate2FASecret(email: string) {
    const secret = speakeasy.generateSecret({
        name: `Cota Reconstruir (${email})`,
        issuer: 'Cota Reconstruir',
        length: 32,
    });

    return {
        secret: secret.base32, // Salvar no Firestore
        otpauthUrl: secret.otpauth_url, // Para gerar QR Code
    };
}

/**
 * Gerar QR Code para configurar no app (Google Authenticator, Authy, etc)
 */
export async function generate2FAQRCode(otpauthUrl: string): Promise<string> {
    try {
        const qrCodeDataURL = await QRCode.toDataURL(otpauthUrl);
        return qrCodeDataURL; // Retorna data URL para exibir na tela
    } catch (error) {
        console.error('Error generating QR code:', error);
        throw new Error('Failed to generate QR code');
    }
}

/**
 * Verificar código 2FA digitado pelo usuário
 */
export function verify2FACode(secret: string, token: string): boolean {
    return speakeasy.totp.verify({
        secret,
        encoding: 'base32',
        token,
        window: 2, // Aceita códigos de até 60 segundos antes/depois
    });
}

/**
 * Gerar código de backup (caso usuário perca acesso ao app)
 * Gerar 10 códigos de 8 caracteres cada
 */
export function generateBackupCodes(count: number = 10): string[] {
    const codes: string[] = [];

    for (let i = 0; i < count; i++) {
        const code = Math.random().toString(36).substring(2, 10).toUpperCase();
        codes.push(code);
    }

    return codes;
}

/**
 * Verificar código de backup
 */
export function verifyBackupCode(userBackupCodes: string[], inputCode: string): {
    valid: boolean;
    remainingCodes?: string[];
} {
    const index = userBackupCodes.indexOf(inputCode.toUpperCase());

    if (index === -1) {
        return { valid: false };
    }

    // Remover código usado (uso único)
    const remainingCodes = [...userBackupCodes];
    remainingCodes.splice(index, 1);

    return {
        valid: true,
        remainingCodes,
    };
}

/**
 * Interface de dados 2FA do usuário (salvar no Firestore)
 */
export interface User2FAData {
    enabled: boolean;
    secret?: string; // Base32 secret
    backupCodes?: string[]; // Códigos de backup
    enrolledAt?: string; // Data de ativação
}

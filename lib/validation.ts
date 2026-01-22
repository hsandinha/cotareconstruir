/**
 * Validação e Sanitização Server-Side
 * Protege contra XSS, SQL Injection e inputs maliciosos
 */

// Sanitização de strings
export function sanitizeString(input: string): string {
    if (typeof input !== 'string') return '';

    return input
        .trim()
        .replace(/[<>]/g, '') // Remove < e >
        .replace(/javascript:/gi, '') // Remove javascript:
        .replace(/on\w+=/gi, '') // Remove event handlers (onclick, onload, etc)
        .replace(/data:text\/html/gi, ''); // Remove data URLs
}

// Sanitização de email
export function sanitizeEmail(email: string): string {
    if (typeof email !== 'string') return '';
    return email.trim().toLowerCase().replace(/[<>]/g, '');
}

// Sanitização de números/IDs
export function sanitizeNumeric(input: string): string {
    if (typeof input !== 'string') return '';
    return input.replace(/[^\d]/g, '');
}

// Validação de CNPJ
export function validateCNPJ(cnpj: string): boolean {
    cnpj = sanitizeNumeric(cnpj);

    if (cnpj.length !== 14) return false;
    if (/^(\d)\1+$/.test(cnpj)) return false;

    let size = cnpj.length - 2;
    let numbers = cnpj.substring(0, size);
    const digits = cnpj.substring(size);
    let sum = 0;
    let pos = size - 7;

    for (let i = size; i >= 1; i--) {
        sum += parseInt(numbers.charAt(size - i)) * pos--;
        if (pos < 2) pos = 9;
    }

    let result = sum % 11 < 2 ? 0 : 11 - (sum % 11);
    if (result !== parseInt(digits.charAt(0))) return false;

    size = size + 1;
    numbers = cnpj.substring(0, size);
    sum = 0;
    pos = size - 7;

    for (let i = size; i >= 1; i--) {
        sum += parseInt(numbers.charAt(size - i)) * pos--;
        if (pos < 2) pos = 9;
    }

    result = sum % 11 < 2 ? 0 : 11 - (sum % 11);
    return result === parseInt(digits.charAt(1));
}

// Validação de CPF
export function validateCPF(cpf: string): boolean {
    cpf = sanitizeNumeric(cpf);

    if (cpf.length !== 11) return false;
    if (/^(\d)\1+$/.test(cpf)) return false;

    let sum = 0;
    let remainder;

    for (let i = 1; i <= 9; i++) {
        sum += parseInt(cpf.substring(i - 1, i)) * (11 - i);
    }

    remainder = (sum * 10) % 11;
    if (remainder === 10 || remainder === 11) remainder = 0;
    if (remainder !== parseInt(cpf.substring(9, 10))) return false;

    sum = 0;
    for (let i = 1; i <= 10; i++) {
        sum += parseInt(cpf.substring(i - 1, i)) * (12 - i);
    }

    remainder = (sum * 10) % 11;
    if (remainder === 10 || remainder === 11) remainder = 0;
    if (remainder !== parseInt(cpf.substring(10, 11))) return false;

    return true;
}

// Validação de email
export function validateEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

// Validação de senha forte
export function validatePassword(password: string): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (password.length < 8) {
        errors.push('Senha deve ter no mínimo 8 caracteres');
    }
    if (!/[A-Z]/.test(password)) {
        errors.push('Senha deve conter ao menos uma letra maiúscula');
    }
    if (!/[a-z]/.test(password)) {
        errors.push('Senha deve conter ao menos uma letra minúscula');
    }
    if (!/[0-9]/.test(password)) {
        errors.push('Senha deve conter ao menos um número');
    }
    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
        errors.push('Senha deve conter ao menos um caractere especial');
    }

    return {
        valid: errors.length === 0,
        errors,
    };
}

// Validação de telefone brasileiro
export function validatePhone(phone: string): boolean {
    const phoneRegex = /^\(\d{2}\)\s?\d{4,5}-?\d{4}$/;
    return phoneRegex.test(phone);
}

// Validação de CEP
export function validateCEP(cep: string): boolean {
    const cepRegex = /^\d{5}-?\d{3}$/;
    return cepRegex.test(cep);
}

// Escape HTML para prevenir XSS
export function escapeHtml(text: string): string {
    const map: Record<string, string> = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;',
    };
    return text.replace(/[&<>"']/g, (m) => map[m]);
}

// Validação de URL
export function validateURL(url: string): boolean {
    try {
        const parsed = new URL(url);
        return ['http:', 'https:'].includes(parsed.protocol);
    } catch {
        return false;
    }
}

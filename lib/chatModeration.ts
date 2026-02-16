export interface ChatModerationResult {
    blocked: boolean;
    reasons: string[];
}

const phoneRegex = /(?:\+?55\s?)?(?:\(?\d{2}\)?\s?)?(?:9\d{4}|\d{4})[-\s]?\d{4}/g;
const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const urlRegex = /(https?:\/\/|www\.)\S+/gi;
const socialHandleRegex = /(?:instagram|insta|telegram|tiktok|facebook|linkedin|discord|skype)\s*[:@]?\s*@?[a-z0-9._-]{3,}/gi;
const contactKeywords = [
    'whatsapp',
    'zap',
    'telefone',
    'celular',
    'me liga',
    'chama no',
    'contato',
    'email',
    'e-mail',
    'arroba',
    'instagram',
    'telegram',
    'fora da plataforma',
    'pagamento por fora',
    'pix direto',
    'transferencia direta',
];

export function analyzeChatMessage(content: string): ChatModerationResult {
    const text = String(content || '').trim();
    const textLower = text.toLowerCase();
    const reasons: string[] = [];

    if (!text) {
        return {
            blocked: false,
            reasons,
        };
    }

    if (emailRegex.test(text)) {
        reasons.push('email');
    }

    if (phoneRegex.test(text)) {
        reasons.push('telefone');
    }

    if (urlRegex.test(text)) {
        reasons.push('link externo');
    }

    if (socialHandleRegex.test(textLower)) {
        reasons.push('rede social');
    }

    if (contactKeywords.some((keyword) => textLower.includes(keyword))) {
        reasons.push('tentativa de contato externo');
    }

    return {
        blocked: reasons.length > 0,
        reasons: Array.from(new Set(reasons)),
    };
}

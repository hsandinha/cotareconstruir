/**
 * Link de acesso direto à cotação enviado ao fornecedor (WhatsApp/email).
 *
 * O link aponta para /login?wa=<token>, onde o token (base64url) carrega o
 * email de login do fornecedor e o id da cotação. A tela de login usa o token
 * para pré-preencher o email e, após autenticar, redirecionar direto para a
 * cotação no painel do fornecedor.
 *
 * Usa apenas APIs universais (atob/btoa) para funcionar em Node, browser e
 * Edge runtime (proxy.ts).
 */

export const PLATFORM_LOGIN_URL = 'https://comprareconstruir.com/login';

export interface QuotationLoginRef {
    email?: string;
    cotacaoId?: string;
}

/**
 * Codifica o payload do link em base64url.
 */
export function encodeLoginRef(ref: QuotationLoginRef): string {
    const payload: Record<string, string> = {};
    if (ref.email) payload.e = ref.email;
    if (ref.cotacaoId) payload.c = ref.cotacaoId;
    const json = JSON.stringify(payload);
    return btoa(encodeURIComponent(json))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');
}

/**
 * Decodifica o token do link. Retorna null se inválido/corrompido.
 */
export function decodeLoginRef(token: string): QuotationLoginRef | null {
    try {
        let b64 = token.replace(/-/g, '+').replace(/_/g, '/');
        while (b64.length % 4 !== 0) b64 += '=';
        const data = JSON.parse(decodeURIComponent(atob(b64)));
        if (!data || typeof data !== 'object') return null;
        const ref: QuotationLoginRef = {};
        if (typeof data.e === 'string' && data.e) ref.email = data.e;
        if (typeof data.c === 'string' && data.c) ref.cotacaoId = data.c;
        return (ref.email || ref.cotacaoId) ? ref : null;
    } catch {
        return null;
    }
}

/**
 * URL completa de login com token (usada no email e como exemplo do template).
 */
export function buildQuotationLoginUrl(ref: QuotationLoginRef): string {
    const token = encodeLoginRef(ref);
    return token ? `${PLATFORM_LOGIN_URL}?wa=${token}` : PLATFORM_LOGIN_URL;
}

/**
 * Caminho interno do painel do fornecedor que abre a cotação diretamente
 * (deep-link já suportado pelo QuotationInboxSection via ?cotacaoId=).
 */
export function quotationDeepLinkPath(cotacaoId?: string): string {
    if (!cotacaoId) return '/dashboard/fornecedor';
    return `/dashboard/fornecedor?tab=vendas-cotacoes&cotacaoId=${encodeURIComponent(cotacaoId)}`;
}

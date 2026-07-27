/**
 * Link de acesso direto à cotação enviado nas notificações (WhatsApp/email),
 * tanto ao fornecedor quanto ao cliente.
 *
 * O link aponta para /login?wa=<token>, onde o token (base64url) carrega o
 * email de login do destinatário, o id da cotação e o papel (cliente ou
 * fornecedor). A tela de login usa o token para pré-preencher o email e, após
 * autenticar, redirecionar direto para a cotação no painel do papel correto.
 *
 * Usa apenas APIs universais (atob/btoa) para funcionar em Node, browser e
 * Edge runtime (proxy.ts).
 */

export const PLATFORM_LOGIN_URL = 'https://comprareconstruir.com/login';

export type QuotationRole = 'cliente' | 'fornecedor';

export interface QuotationLoginRef {
    email?: string;
    cotacaoId?: string;
    /** Painel de destino do deep-link. Ausente = fornecedor (retrocompatível). */
    role?: QuotationRole;
}

/**
 * Codifica o payload do link em base64url.
 */
export function encodeLoginRef(ref: QuotationLoginRef): string {
    const payload: Record<string, string> = {};
    if (ref.email) payload.e = ref.email;
    if (ref.cotacaoId) payload.c = ref.cotacaoId;
    if (ref.role) payload.r = ref.role;
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
        if (data.r === 'cliente' || data.r === 'fornecedor') ref.role = data.r;
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
 * Caminho interno do painel que abre a cotação diretamente (deep-link já
 * suportado por ?cotacaoId= em ambos os painéis). O painel de destino segue o
 * papel do destinatário; ausência de papel assume fornecedor (retrocompatível).
 */
export function quotationDeepLinkPath(cotacaoId?: string, role: QuotationRole = 'fornecedor'): string {
    const home = role === 'cliente' ? '/dashboard/cliente' : '/dashboard/fornecedor';
    if (!cotacaoId) return home;
    const tab = role === 'cliente' ? 'pedidos' : 'vendas-cotacoes';
    return `${home}?tab=${tab}&cotacaoId=${encodeURIComponent(cotacaoId)}`;
}

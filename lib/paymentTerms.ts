/**
 * Condições de pagamento das propostas.
 *
 * O campo é texto livre (ex.: "Boleto 28/40/60"), mas propostas antigas
 * gravaram chaves fixas do select antigo — este helper as converte para
 * rótulos legíveis.
 */

const LEGACY_PAYMENT_LABELS: Record<string, string> = {
    'vista': 'À vista',
    '15-dias': '15 dias',
    '30-dias': '30 dias',
    '30-60-dias': '30/60 dias',
    '30-60-90-dias': '30/60/90 dias',
};

export function formatPaymentTerms(value?: string | null): string {
    const raw = String(value || '').trim();
    if (!raw) return '';
    return LEGACY_PAYMENT_LABELS[raw] || raw;
}

/** Sugestões exibidas no datalist do campo digitável. */
export const PAYMENT_TERMS_SUGGESTIONS = [
    'À vista',
    'Pix',
    'Boleto 15 dias',
    'Boleto 30 dias',
    'Boleto 28/40/60',
    'Boleto 30/60/90',
    'Cartão de crédito',
];

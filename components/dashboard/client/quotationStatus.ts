export interface QuotationStatusBadge {
    label: string;
    color: string;
}

export function getQuotationStatusBadge(status: string, propostasCount: number = 0): QuotationStatusBadge {
    switch (status) {
        case 'rascunho':
            return { label: 'Rascunho', color: 'text-gray-700 bg-gray-50' };
        case 'enviada':
            return propostasCount > 0
                ? { label: 'Propostas em andamento', color: 'text-green-700 bg-green-50' }
                : { label: 'Aguardando Fornecedores', color: 'text-yellow-700 bg-yellow-50' };
        case 'em_analise':
            return { label: 'Em Análise', color: 'text-blue-700 bg-blue-50' };
        case 'respondida':
            return { label: 'Propostas Recebidas', color: 'text-green-700 bg-green-50' };
        case 'fechada':
            return { label: 'Finalizado', color: 'text-gray-700 bg-gray-50' };
        case 'cancelada':
            return { label: 'Cancelado', color: 'text-red-700 bg-red-50' };
        default:
            return { label: 'Em Análise', color: 'text-blue-700 bg-blue-50' };
    }
}

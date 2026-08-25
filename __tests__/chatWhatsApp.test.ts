import { devoAvisarFornecedorNoChat } from '@/lib/whatsappService';

const CLIENTE = 'user-cliente';
const FORNECEDOR = 'forn-1';

/** Caso base: cliente abre a conversa, primeira mensagem da sala. */
const abertura = {
    totalMensagensNaSala: 1,
    autorId: CLIENTE,
    clienteId: CLIENTE,
    fornecedorId: FORNECEDOR,
};

describe('aviso no WhatsApp ao abrir conversa', () => {
    it('avisa quando o cliente manda a primeira mensagem', () => {
        expect(devoAvisarFornecedorNoChat(abertura)).toBe(true);
    });

    it('NÃO avisa da segunda mensagem em diante', () => {
        // A regra que impede o spam: sem isso, cada mensagem viraria
        // um disparo e a Meta puniria o número.
        expect(devoAvisarFornecedorNoChat({ ...abertura, totalMensagensNaSala: 2 })).toBe(false);
        expect(devoAvisarFornecedorNoChat({ ...abertura, totalMensagensNaSala: 37 })).toBe(false);
    });

    it('NÃO avisa quando quem escreve é o fornecedor', () => {
        // Ele não precisa ser avisado da própria mensagem
        expect(devoAvisarFornecedorNoChat({ ...abertura, autorId: 'user-fornecedor' })).toBe(false);
    });

    it('NÃO avisa sem fornecedor identificado na sala', () => {
        expect(devoAvisarFornecedorNoChat({ ...abertura, fornecedorId: null })).toBe(false);
        expect(devoAvisarFornecedorNoChat({ ...abertura, fornecedorId: '' })).toBe(false);
    });

    it('NÃO avisa com dados faltando, em vez de disparar por engano', () => {
        expect(devoAvisarFornecedorNoChat({ ...abertura, autorId: null })).toBe(false);
        expect(devoAvisarFornecedorNoChat({ ...abertura, clienteId: null })).toBe(false);
        expect(devoAvisarFornecedorNoChat({ ...abertura, totalMensagensNaSala: 0 })).toBe(false);
    });
});

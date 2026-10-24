import {
    acessoLiberado,
    assinaturasEsperadas,
    calcularComissao,
    centavosDeTexto,
    codigoSugerido,
    codigoValido,
    competenciaDe,
    dentroDaJanela,
    fimDaJanela,
    fimDoTrial,
    formatarCentavos,
    gerarCodigoAfiliado,
    normalizarCodigo,
    proximaCobranca,
    somarMeses,
} from '@/lib/cobrancaModelo';

/**
 * O Intl do pt-BR separa "R$" do número com espaço NÃO-QUEBRÁVEL (U+00A0).
 * Comparar com espaço comum falharia por um caractere invisível.
 */
const moeda = (texto: string) => texto.replace(/\u00A0/g, ' ');

describe('dinheiro em centavos', () => {
    it('formata o preço da assinatura', () => {
        expect(moeda(formatarCentavos(49900))).toBe('R$ 499,00');
        expect(moeda(formatarCentavos(0))).toBe('R$ 0,00');
    });

    it('lê o que o admin digita de verdade', () => {
        expect(centavosDeTexto('R$ 499,00')).toBe(49900);
        expect(centavosDeTexto('499,00')).toBe(49900);
        expect(centavosDeTexto('499.00')).toBe(49900);
        expect(centavosDeTexto('499')).toBe(49900);
        expect(centavosDeTexto('1.499,90')).toBe(149990);
        expect(centavosDeTexto('1,499.90')).toBe(149990);
        expect(centavosDeTexto(499)).toBe(49900);
    });

    it('devolve null em vez de zero quando não dá para ler', () => {
        // Zero silencioso num campo de preço é pior que erro: a assinatura
        // passaria a ser de graça sem ninguém perceber.
        expect(centavosDeTexto('')).toBeNull();
        expect(centavosDeTexto('abc')).toBeNull();
        expect(centavosDeTexto(null)).toBeNull();
        expect(centavosDeTexto('R$')).toBeNull();
    });

    it('trata 3 dígitos depois do ponto como milhar, não centavos', () => {
        expect(centavosDeTexto('1.499')).toBe(149900);
    });
});

describe('comissão', () => {
    it('calcula 20% de R$ 499,00 no centavo', () => {
        expect(calcularComissao(49900, 20)).toBe(9980);
        expect(moeda(formatarCentavos(calcularComissao(49900, 20)))).toBe('R$ 99,80');
    });

    it('arredonda para o centavo mais próximo', () => {
        // 15% de 49900 = 7485 exato; 33% = 16467
        expect(calcularComissao(49900, 15)).toBe(7485);
        expect(calcularComissao(49900, 33)).toBe(16467);
        // 7,5% de 10333 = 774,975 → 775
        expect(calcularComissao(10333, 7.5)).toBe(775);
    });

    it('recusa percentual absurdo em vez de pagar a mais', () => {
        expect(calcularComissao(49900, 0)).toBe(0);
        expect(calcularComissao(49900, -5)).toBe(0);
        expect(calcularComissao(49900, 2000)).toBe(0);
        expect(calcularComissao(49900, NaN)).toBe(0);
    });

    it('nunca devolve valor negativo', () => {
        expect(calcularComissao(-100, 20)).toBe(0);
    });
});

describe('datas de cobrança', () => {
    it('reduz qualquer data à competência do mês', () => {
        expect(competenciaDe('2026-10-23T18:30:00Z')).toBe('2026-10-01');
        expect(competenciaDe('2026-01-31T23:59:59Z')).toBe('2026-01-01');
    });

    it('preserva o fim do mês ao somar meses', () => {
        // O setMonth do JS transborda 31/01 + 1 mês para 03/03. Cobrar no dia
        // 3 quem assinou dia 31 gera chamado no suporte todo mês.
        expect(somarMeses('2026-01-31T00:00:00Z', 1).toISOString().slice(0, 10)).toBe('2026-02-28');
        expect(somarMeses('2026-03-31T00:00:00Z', 1).toISOString().slice(0, 10)).toBe('2026-04-30');
        expect(somarMeses('2026-01-15T00:00:00Z', 1).toISOString().slice(0, 10)).toBe('2026-02-15');
    });

    it('acerta fevereiro de ano bissexto', () => {
        expect(somarMeses('2028-01-31T00:00:00Z', 1).toISOString().slice(0, 10)).toBe('2028-02-29');
    });

    it('respeita o ciclo contratado', () => {
        const base = '2026-10-23T00:00:00Z';
        expect(proximaCobranca(base, 'mensal').toISOString().slice(0, 10)).toBe('2026-11-23');
        expect(proximaCobranca(base, 'trimestral').toISOString().slice(0, 10)).toBe('2027-01-23');
        expect(proximaCobranca(base, 'anual').toISOString().slice(0, 10)).toBe('2027-10-23');
    });

    it('calcula o fim do teste grátis', () => {
        expect(fimDoTrial('2026-10-23T00:00:00Z', 30)?.toISOString().slice(0, 10)).toBe('2026-11-22');
        expect(fimDoTrial('2026-10-23T00:00:00Z', 0)).toBeNull();
    });
});

describe('janela da comissão', () => {
    it('conta 12 meses a partir do PRIMEIRO pagamento', () => {
        // Não do cadastro: com 30 dias de teste, contar do cadastro queimaria
        // o primeiro mês do parceiro num período sem pagamento nenhum.
        expect(fimDaJanela('2026-11-01', 12)).toBe('2027-11-01');
        expect(fimDaJanela('2026-11-01', 18)).toBe('2028-05-01');
    });

    it('duração nula significa vitalício', () => {
        expect(fimDaJanela('2026-11-01', null)).toBeNull();
        expect(fimDaJanela('2026-11-01', undefined)).toBeNull();
    });

    it('inclui o mês inicial e exclui o mês do fim', () => {
        const inicio = '2026-11-01';
        const fim = fimDaJanela(inicio, 12)!;

        expect(dentroDaJanela('2026-11-01', inicio, fim)).toBe(true);  // 1º mês
        expect(dentroDaJanela('2027-10-01', inicio, fim)).toBe(true);  // 12º mês
        expect(dentroDaJanela('2027-11-01', inicio, fim)).toBe(false); // 13º, acabou
    });

    it('não paga competência anterior ao início', () => {
        expect(dentroDaJanela('2026-10-01', '2026-11-01', '2027-11-01')).toBe(false);
    });

    it('vitalício aceita qualquer competência futura', () => {
        expect(dentroDaJanela('2099-01-01', '2026-11-01', null)).toBe(true);
    });
});

describe('o que cobrar', () => {
    const obras = [{ id: 'obra-1' }, { id: 'obra-2' }, { id: 'obra-3' }];

    it('por obra gera uma assinatura por obra', () => {
        expect(assinaturasEsperadas('por_obra', obras)).toEqual([
            { obraId: 'obra-1' }, { obraId: 'obra-2' }, { obraId: 'obra-3' },
        ]);
    });

    it('por cliente e por conta geram uma só', () => {
        expect(assinaturasEsperadas('por_cliente', obras)).toEqual([{ obraId: null }]);
        expect(assinaturasEsperadas('por_conta', obras)).toEqual([{ obraId: null }]);
    });

    it('cliente sem obra não gera assinatura no modelo por obra', () => {
        expect(assinaturasEsperadas('por_obra', [])).toEqual([]);
    });
});

describe('acesso por situação de pagamento', () => {
    const base = { cobrancaAtiva: true, diasTolerancia: 5, hoje: new Date('2026-11-10T12:00:00Z') };

    it('não barra ninguém enquanto a cobrança está desligada', () => {
        // É o estado de hoje: turma em teste, nada cobrado.
        expect(acessoLiberado({ ...base, cobrancaAtiva: false, status: 'inadimplente' })).toBe(true);
    });

    it('libera trial e ativa, bloqueia cancelada', () => {
        expect(acessoLiberado({ ...base, status: 'trial' })).toBe(true);
        expect(acessoLiberado({ ...base, status: 'ativa' })).toBe(true);
        expect(acessoLiberado({ ...base, status: 'cancelada' })).toBe(false);
        expect(acessoLiberado({ ...base, status: 'encerrada' })).toBe(false);
    });

    it('dá a tolerância ao inadimplente antes de cortar', () => {
        // Boleto que atrasou no banco não pode derrubar a obra no mesmo dia.
        expect(acessoLiberado({ ...base, status: 'inadimplente', vencimentoMaisAntigo: '2026-11-08' })).toBe(true);
        expect(acessoLiberado({ ...base, status: 'inadimplente', vencimentoMaisAntigo: '2026-11-01' })).toBe(false);
    });
});

describe('código do parceiro', () => {
    it('deriva do nome, sem acento nem espaço', () => {
        expect(codigoSugerido('Marcos Vieira')).toBe('MARCOSVIEI');
        expect(codigoSugerido('João Gonçalves')).toBe('JOAOGONCAL');
    });

    it('cai no aleatório quando o nome é curto demais', () => {
        expect(codigoSugerido('Jo')).toHaveLength(6);
    });

    it('normaliza o que vier na URL', () => {
        expect(normalizarCodigo(' marcos ')).toBe('MARCOS');
        expect(normalizarCodigo('mar-cos!')).toBe('MARCOS');
        expect(normalizarCodigo(null)).toBe('');
    });

    it('valida contra a mesma regra da constraint do banco', () => {
        expect(codigoValido('MARCOS')).toBe(true);
        expect(codigoValido('ABC')).toBe(false);         // curto demais
        expect(codigoValido('MARCOS-X')).toBe(false);    // caractere fora
        expect(codigoValido('A'.repeat(21))).toBe(false); // longo demais
    });

    it('gera código sem caractere ambíguo', () => {
        // O código é ditado por telefone: 0/O e 1/I/L viram chamado.
        for (let i = 0; i < 200; i++) {
            expect(gerarCodigoAfiliado()).not.toMatch(/[0O1IL]/);
        }
    });

    it('o código gerado passa na própria validação', () => {
        for (let i = 0; i < 50; i++) {
            expect(codigoValido(gerarCodigoAfiliado())).toBe(true);
        }
    });
});

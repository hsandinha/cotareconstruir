import * as XLSX from 'xlsx';
import {
    diasDaValidade,
    gerarPlanilhaResposta,
    lerRespostaPlanilha,
    montarItensProposta,
    nomeArquivoPlanilha,
    normalizarDisponibilidade,
    numeroDoNomeArquivo,
    pareceAnexoDeCotacao,
} from '@/lib/cotacaoPlanilha';

const COTACAO = { id: '11111111-2222-3333-4444-555555555555', numero: '10070' };

const ITENS = [
    { id: 'aaaaaaaa-0000-4000-8000-000000000001', nome: 'Cimento CP II 50kg', fabricante: 'Votoran', unidade: 'SC', quantidade: 100 },
    { id: 'aaaaaaaa-0000-4000-8000-000000000002', nome: 'Areia média', fabricante: '', unidade: 'M3', quantidade: 12 },
    { id: 'aaaaaaaa-0000-4000-8000-000000000003', nome: 'Vergalhão CA-50 10mm', fabricante: 'Gerdau', unidade: 'BR', quantidade: 40 },
];

/**
 * Simula o fornecedor abrindo o arquivo, digitando preços e salvando por
 * cima — é o caminho feliz que a funcionalidade inteira depende.
 */
function preencherPrecos(planilha: Buffer, precos: Record<string, string>): Buffer {
    const wb = XLSX.read(planilha, { type: 'buffer' });
    const aba = wb.Sheets['Resposta'];
    const matriz = XLSX.utils.sheet_to_json<string[]>(aba, { header: 1, raw: false, defval: '' });

    const cabecalho = matriz[0];
    const colId = cabecalho.indexOf('cotacao_item_id');
    const colPreco = cabecalho.indexOf('preco_unitario');

    for (let i = 1; i < matriz.length; i++) {
        const preco = precos[matriz[i][colId]];
        if (preco !== undefined) matriz[i][colPreco] = preco;
    }

    wb.Sheets['Resposta'] = XLSX.utils.aoa_to_sheet(matriz);
    return XLSX.write(wb, { bookType: 'xlsx', type: 'buffer' }) as Buffer;
}

describe('planilha de resposta da cotação', () => {
    it('gera uma linha por item, com tudo pronto menos o preço', () => {
        const planilha = gerarPlanilhaResposta(COTACAO, ITENS);
        const lida = lerRespostaPlanilha(planilha, nomeArquivoPlanilha(COTACAO.numero));

        expect(lida.linhas).toHaveLength(3);
        expect(lida.linhas.map((l) => l.material)).toEqual([
            'Cimento CP II 50kg',
            'Areia média',
            'Vergalhão CA-50 10mm',
        ]);
        // A promessa feita ao fornecedor: só o preço está em branco.
        expect(lida.linhas.every((l) => l.precoUnitario === null)).toBe(true);
        expect(lida.linhas.every((l) => l.disponibilidade === 'disponivel')).toBe(true);
    });

    it('volta sabendo de qual cotação é, mesmo salva por cima no Excel', () => {
        const preenchida = preencherPrecos(gerarPlanilhaResposta(COTACAO, ITENS), {
            [ITENS[0].id]: '38,90',
        });
        const lida = lerRespostaPlanilha(preenchida, 'cotacao-10070.xlsx');

        expect(lida.ref.cotacaoId).toBe(COTACAO.id);
        expect(lida.ref.numero).toBe('10070');
    });

    it('lê preço com vírgula decimal, que é como se digita no Brasil', () => {
        const preenchida = preencherPrecos(gerarPlanilhaResposta(COTACAO, ITENS), {
            [ITENS[0].id]: '38,90',
            [ITENS[1].id]: 'R$ 1.250,00',
        });
        const lida = lerRespostaPlanilha(preenchida, 'cotacao-10070.xlsx');

        expect(lida.linhas[0].precoUnitario).toBeCloseTo(38.9);
        expect(lida.linhas[1].precoUnitario).toBeCloseTo(1250);
        expect(lida.linhas[2].precoUnitario).toBeNull();
    });

    it('nomeia o arquivo com o número da cotação e o lê de volta', () => {
        expect(nomeArquivoPlanilha('10070')).toBe('cotacao-10070.xlsx');
        expect(numeroDoNomeArquivo('cotacao-10070.xlsx')).toBe('10070');
        expect(numeroDoNomeArquivo('Cotacao_10070 (1).xlsx')).toBe('10070');
        expect(numeroDoNomeArquivo('orcamento.pdf')).toBe('');
    });

    it('aceita CSV, que é o que sobra quando convertem a planilha', () => {
        const csv = [
            'cotacao_item_id;material;unidade;quantidade;preco_unitario;valor_frete',
            `${ITENS[0].id};Cimento CP II 50kg;SC;100;38,90;250`,
            `${ITENS[1].id};Areia média;M3;12;;`,
        ].join('\n');

        const lida = lerRespostaPlanilha(new TextEncoder().encode(csv), 'cotacao-10070.csv');

        // Sem a aba `_ref`, o id do item é o que leva de volta à cotação.
        expect(lida.ref.cotacaoId).toBeUndefined();
        expect(lida.linhas[0].cotacaoItemId).toBe(ITENS[0].id);
        expect(lida.linhas[0].precoUnitario).toBeCloseTo(38.9);
        expect(lida.condicoes.valorFrete).toBe(250);
    });

    it('normaliza disponibilidade e validade escritas de qualquer jeito', () => {
        expect(normalizarDisponibilidade('Sim')).toBe('disponivel');
        expect(normalizarDisponibilidade('sob consulta')).toBe('sob_consulta');
        expect(normalizarDisponibilidade('NÃO')).toBe('indisponivel');
        expect(normalizarDisponibilidade('qualquer coisa')).toBe('');

        expect(diasDaValidade('15-dias')).toBe(15);
        // Sem rótulo reconhecível a proposta não pode ficar sem validade.
        expect(diasDaValidade('')).toBe(30);
    });
});

describe('montagem dos itens da proposta', () => {
    const linhas = (precos: Array<number | null>, ids = ITENS.map((i) => i.id)) =>
        ITENS.map((item, i) => ({
            cotacaoItemId: ids[i],
            material: item.nome,
            precoUnitario: precos[i],
            disponibilidade: '' as const,
        }));

    it('marca como indisponível o item que ficou sem preço', () => {
        const itens = montarItensProposta(ITENS, linhas([38.9, null, 7.5]));

        expect(itens).toHaveLength(3);
        expect(itens[0]).toMatchObject({ preco_unitario: 38.9, disponibilidade: 'disponivel', prazo_dias: 0 });
        expect(itens[1]).toMatchObject({ preco_unitario: 0, subtotal: 0, disponibilidade: 'indisponivel', prazo_dias: -1 });
        expect(itens[2].subtotal).toBeCloseTo(7.5 * 40);
    });

    it('casa pelo nome do material quando a coluna de id foi perdida', () => {
        const itens = montarItensProposta(ITENS, linhas([38.9, 120, null], ['', '', '']));

        expect(itens[0].preco_unitario).toBeCloseTo(38.9);
        expect(itens[1].preco_unitario).toBeCloseTo(120);
    });

    it('mantém todos os itens da cotação, mesmo os que não vieram na planilha', () => {
        // Linha faltando é falha de preenchimento; some do mapa comparativo
        // se o item sumir, e o cliente lê isso como erro de envio.
        const itens = montarItensProposta(ITENS, [
            { cotacaoItemId: ITENS[0].id, material: ITENS[0].nome, precoUnitario: 38.9, disponibilidade: '' },
        ]);

        expect(itens).toHaveLength(3);
        expect(itens.slice(1).every((i) => i.disponibilidade === 'indisponivel')).toBe(true);
    });

    it('ignora preço negativo em vez de gerar subtotal negativo', () => {
        const itens = montarItensProposta(ITENS, linhas([-10, null, null]));
        expect(itens[0].preco_unitario).toBe(0);
        expect(itens[0].disponibilidade).toBe('indisponivel');
    });
});

describe('triagem do anexo recebido', () => {
    const base = { from: '5531999998888', messageId: 'wamid.1', timestamp: '0', raw: {} };

    it('aceita planilha e CSV', () => {
        expect(pareceAnexoDeCotacao({
            ...base, type: 'document', mediaFilename: 'cotacao-10070.xlsx',
            mediaMime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        })).toBe(true);
        expect(pareceAnexoDeCotacao({
            ...base, type: 'document', mediaFilename: 'resposta.csv', mediaMime: 'text/csv',
        })).toBe(true);
    });

    it('ignora o resto, sem gastar download na Meta', () => {
        expect(pareceAnexoDeCotacao({ ...base, type: 'image', mediaMime: 'image/jpeg' })).toBe(false);
        expect(pareceAnexoDeCotacao({ ...base, type: 'text', text: 'oi' })).toBe(false);
        expect(pareceAnexoDeCotacao({
            ...base, type: 'document', mediaFilename: 'nota.pdf', mediaMime: 'application/pdf',
        })).toBe(false);
    });
});

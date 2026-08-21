import {
    getStatusTurma,
    reservarVaga,
    validarConvite,
    gerarConviteToken,
    diasRestantesDoTeste,
    TURMA_PADRAO,
} from '@/lib/lancamentoService';

/** Cliente falso: devolve o que o teste mandar para cada RPC. */
const fakeClient = (resposta: { data?: any; error?: any } | (() => never)) => ({
    rpc: async () => {
        if (typeof resposta === 'function') resposta();
        return resposta as { data: any; error: any };
    },
});

describe('situação da turma', () => {
    it('lê as vagas do banco', async () => {
        const client = fakeClient({
            data: [{ vagas_total: 20, vagas_ocupadas: 7, inscricoes_abertas: true, dias_teste: 30, obras_por_conta: 1 }],
            error: null,
        });

        await expect(getStatusTurma(client)).resolves.toEqual({
            vagasTotal: 20,
            vagasOcupadas: 7,
            vagasRestantes: 13,
            inscricoesAbertas: true,
            diasTeste: 30,
            obrasPorConta: 1,
        });
    });

    it('nunca deixa as vagas restantes negativas', async () => {
        const client = fakeClient({
            data: [{ vagas_total: 20, vagas_ocupadas: 25, inscricoes_abertas: false, dias_teste: 30, obras_por_conta: 1 }],
            error: null,
        });

        const status = await getStatusTurma(client);
        expect(status.vagasRestantes).toBe(0);
        expect(status.inscricoesAbertas).toBe(false);
    });

    it('cai no padrão com inscrições abertas quando o banco falha', async () => {
        // Sem isso, uma migration não aplicada travaria todos os cadastros
        await expect(getStatusTurma(fakeClient({ data: null, error: { message: 'função inexistente' } })))
            .resolves.toEqual(TURMA_PADRAO);
        expect(TURMA_PADRAO.inscricoesAbertas).toBe(true);
    });
});

describe('reserva de vaga', () => {
    const params = { userId: 'u1', clienteId: 'c1', nome: 'Construtor', email: 'x@y.com' };

    it('devolve a vaga quando há lugar na turma', async () => {
        const client = fakeClient({
            data: { id: 'v1', posicao: 3, teste_fim: '2026-09-20T00:00:00Z' },
            error: null,
        });

        const r = await reservarVaga(client, params);
        expect(r.ok).toBe(true);
        if (r.ok) expect(r.vaga.posicao).toBe(3);
    });

    it('marca "sem_vaga" quando a função responde vazio (turma cheia)', async () => {
        const r = await reservarVaga(fakeClient({ data: null, error: null }), params);
        expect(r).toEqual({ ok: false, motivo: 'sem_vaga' });
    });

    it('marca "indisponivel" quando o RPC dá erro', async () => {
        const r = await reservarVaga(fakeClient({ data: null, error: { message: 'boom' } }), params);
        expect(r).toEqual({ ok: false, motivo: 'indisponivel' });
    });

    it('marca "indisponivel" quando o RPC lança', async () => {
        const r = await reservarVaga(fakeClient(() => { throw new Error('rede'); }), params);
        expect(r).toEqual({ ok: false, motivo: 'indisponivel' });
    });
});

describe('dias restantes do teste', () => {
    const emDias = (d: number) => new Date(Date.now() + d * 86400000).toISOString();

    it('conta os dias que faltam', () => {
        expect(diasRestantesDoTeste(emDias(10))).toBe(10);
    });

    it('não devolve negativo em teste vencido', () => {
        expect(diasRestantesDoTeste(emDias(-5))).toBe(0);
    });

    it('trata data ausente ou inválida', () => {
        expect(diasRestantesDoTeste(null)).toBe(0);
        expect(diasRestantesDoTeste('nao-e-data')).toBe(0);
    });
});

describe('convite da fila de espera', () => {
    it('devolve os dados quando o token vale', async () => {
        const client = fakeClient({
            data: [{ nome: 'Construtor', email: 'c@obra.com', expira_em: '2026-08-28T00:00:00Z' }],
            error: null,
        });

        await expect(validarConvite(client, 'tok')).resolves.toEqual({
            nome: 'Construtor',
            email: 'c@obra.com',
            expiraEm: '2026-08-28T00:00:00Z',
        });
    });

    it('recusa token vazio sem ir ao banco', async () => {
        const client = fakeClient(() => { throw new Error('nao deveria chamar'); });
        await expect(validarConvite(client, '')).resolves.toBeNull();
    });

    it('recusa token expirado ou já usado (função devolve vazio)', async () => {
        await expect(validarConvite(fakeClient({ data: [], error: null }), 'tok')).resolves.toBeNull();
    });

    it('recusa quando o banco falha, em vez de liberar entrada', async () => {
        await expect(validarConvite(fakeClient({ data: null, error: { message: 'boom' } }), 'tok'))
            .resolves.toBeNull();
    });

    it('gera tokens opacos e distintos', () => {
        const a = gerarConviteToken();
        const b = gerarConviteToken();
        expect(a).toHaveLength(48);
        expect(a).toMatch(/^[0-9a-f]+$/);
        expect(a).not.toBe(b);
    });
});

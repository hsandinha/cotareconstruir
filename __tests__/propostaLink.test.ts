import {
    chaveConvite,
    expiraEm,
    gerarToken,
    hashToken,
    tokenPlausivel,
    urlDaProposta,
    VALIDADE_PADRAO_DIAS,
} from '@/lib/propostaLink';

describe('token de resposta', () => {
    it('gera token com entropia suficiente para valer como senha', () => {
        // 32 bytes em base64url = 43 caracteres.
        const token = gerarToken();
        expect(token).toHaveLength(43);
        expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
    });

    it('nunca repete', () => {
        const vistos = new Set(Array.from({ length: 500 }, () => gerarToken()));
        expect(vistos.size).toBe(500);
    });

    it('cabe numa URL sem escapar nada', () => {
        for (let i = 0; i < 100; i++) {
            const token = gerarToken();
            expect(encodeURIComponent(token)).toBe(token);
        }
    });

    it('o token gerado passa na própria triagem', () => {
        for (let i = 0; i < 100; i++) {
            expect(tokenPlausivel(gerarToken())).toBe(true);
        }
    });
});

describe('hash guardado no banco', () => {
    it('é SHA-256 em hex', () => {
        expect(hashToken('qualquer-coisa')).toMatch(/^[0-9a-f]{64}$/);
    });

    it('é determinístico — é o que permite achar a linha pelo índice', () => {
        const token = gerarToken();
        expect(hashToken(token)).toBe(hashToken(token));
    });

    it('token diferente, hash diferente', () => {
        expect(hashToken(gerarToken())).not.toBe(hashToken(gerarToken()));
    });

    it('não devolve o token de volta', () => {
        // O ponto inteiro de guardar hash: quem lê a tabela não responde no
        // lugar de ninguém.
        const token = gerarToken();
        expect(hashToken(token)).not.toContain(token);
    });
});

describe('triagem antes de ir ao banco', () => {
    it('recusa o que não tem forma de token', () => {
        // Evita que lixo colado na URL vire consulta ao banco.
        expect(tokenPlausivel('')).toBe(false);
        expect(tokenPlausivel('abc')).toBe(false);
        expect(tokenPlausivel(null)).toBe(false);
        expect(tokenPlausivel(123)).toBe(false);
        expect(tokenPlausivel('a'.repeat(200))).toBe(false);
        expect(tokenPlausivel('token com espaço aqui dentro!!')).toBe(false);
    });

    it('recusa tentativa de injeção pela URL', () => {
        expect(tokenPlausivel("' OR 1=1 --")).toBe(false);
        expect(tokenPlausivel('../../etc/passwd')).toBe(false);
    });
});

describe('link e validade', () => {
    it('monta a URL que vai na mensagem', () => {
        const token = gerarToken();
        expect(urlDaProposta(token)).toContain(`/proposta/${token}`);
    });

    it('expira no prazo padrão', () => {
        const limite = new Date(expiraEm());
        const esperado = new Date();
        esperado.setUTCDate(esperado.getUTCDate() + VALIDADE_PADRAO_DIAS);
        // Tolerância de um minuto: o relógio anda entre as duas linhas.
        expect(Math.abs(limite.getTime() - esperado.getTime())).toBeLessThan(60_000);
    });

    it('nunca expira no passado, nem com prazo absurdo', () => {
        expect(new Date(expiraEm(0)).getTime()).toBeGreaterThan(Date.now());
        expect(new Date(expiraEm(-10)).getTime()).toBeGreaterThan(Date.now());
    });
});

describe('chave do convite', () => {
    it('identifica o par cotação/fornecedor', () => {
        expect(chaveConvite('cot-1', 'forn-1')).toBe('cot-1:forn-1');
        // Não pode colidir com o par invertido
        expect(chaveConvite('a', 'b')).not.toBe(chaveConvite('b', 'a'));
    });
});

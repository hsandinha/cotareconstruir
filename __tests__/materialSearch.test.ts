import { scoreTermMatch, textIncludesTerm, expandTermWithSynonyms } from '@/lib/materialSearch';

const CATALOGO = [
    'CABO FLEXÍVEL 1,5 CINZA',
    'CABO FLEXÍVEL 1,5 AZUL',
    'CABO FLEXÍVEL 1,5 PRETO',
    'CABO FLEXÍVEL 2,5 AZUL',
    'CABO PP 3X2,5',
    'TERMINAL PARA CABO FLEXÍVEL 1,5',
    'ABRAÇADEIRA DE CABO 1,5',
    'CANALETA PARA CABO',
];

const buscar = (termo: string) => CATALOGO.filter((nome) => textIncludesTerm(nome, termo));

describe('busca ancorada no início da descrição', () => {
    it('traz todas as especificações que começam com o termo', () => {
        expect(buscar('cabo')).toEqual([
            'CABO FLEXÍVEL 1,5 CINZA',
            'CABO FLEXÍVEL 1,5 AZUL',
            'CABO FLEXÍVEL 1,5 PRETO',
            'CABO FLEXÍVEL 2,5 AZUL',
            'CABO PP 3X2,5',
        ]);
    });

    it('não traz especificações com o termo no meio da descrição', () => {
        const resultado = buscar('cabo');
        expect(resultado).not.toContain('TERMINAL PARA CABO FLEXÍVEL 1,5');
        expect(resultado).not.toContain('ABRAÇADEIRA DE CABO 1,5');
        expect(resultado).not.toContain('CANALETA PARA CABO');
    });

    it('refina por prefixo de palavra: bitola e depois cor', () => {
        expect(buscar('cabo flex')).toHaveLength(4);
        expect(buscar('cabo flex 1,5')).toHaveLength(3);
        expect(buscar('cabo flex 1,5 azul')).toEqual(['CABO FLEXÍVEL 1,5 AZUL']);
    });

    it('ignora maiúsculas/minúsculas e acentos', () => {
        expect(textIncludesTerm('CABO FLEXÍVEL 1,5 AZUL', 'CaBo FlExIvEl')).toBe(true);
        expect(textIncludesTerm('CABO FLEXÍVEL 1,5 AZUL', 'cabo flexível')).toBe(true);
    });

    it('não casa quando a palavra aparece só no miolo de outra palavra', () => {
        expect(textIncludesTerm('MULTICABO 4 PARES', 'cabo')).toBe(false);
    });

    it('ranqueia o começo exato acima das demais', () => {
        const exato = scoreTermMatch('CABO FLEXÍVEL 1,5 AZUL', 'cabo flexível 1,5 azul');
        const parcial = scoreTermMatch('CABO FLEXÍVEL 1,5 AZUL', 'cabo azul');
        expect(exato).toBeGreaterThan(parcial);
    });
});

describe('sinônimos', () => {
    const grupos = [['cabo', 'fio'], ['bacia', 'vaso sanitário']];

    it('troca a palavra mantendo a âncora: "fio flex" → "cabo flex"', () => {
        const variantes = expandTermWithSynonyms('fio flex', grupos);
        expect(variantes).toContain('cabo flex');
        expect(variantes.some((v) => buscar(v).length === 4)).toBe(true);
    });

    it('expande o termo inteiro: "bacia" → "vaso sanitario"', () => {
        expect(expandTermWithSynonyms('bacia', grupos)).toContain('vaso sanitario');
    });
});

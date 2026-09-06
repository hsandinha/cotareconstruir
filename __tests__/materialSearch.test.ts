import { scoreTermMatch, textIncludesTerm, expandTermWithSynonyms, descricaoAcrescentaAlgo } from '@/lib/materialSearch';

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

describe('descrição repetida do catálogo', () => {

    it('esconde quando a descrição é igual ao nome', () => {
        // 99,8% do catálogo importado está assim
        expect(descricaoAcrescentaAlgo('ARGAMASSA ACII 20KG (U) (Sc)', 'ARGAMASSA ACII 20KG (U) (Sc)')).toBe(false);
    });

    it('esconde ignorando caixa e acento', () => {
        expect(descricaoAcrescentaAlgo('Cimento CP II', 'CIMENTO CP II')).toBe(false);
        expect(descricaoAcrescentaAlgo('Cal hidratada CH-III', 'cal hidratada ch-iii')).toBe(false);
    });

    it('esconde quando a descrição só repete parte do nome', () => {
        expect(descricaoAcrescentaAlgo('TUBO PVC SOLDA 50MM 6M', 'TUBO PVC SOLDA')).toBe(false);
    });

    it('mostra quando a descrição acrescenta informação', () => {
        expect(descricaoAcrescentaAlgo('PLATAFORMA ELEVATORIA TESOURA', 'ALCANCE DE 8MTS A 12MTS')).toBe(true);
        expect(descricaoAcrescentaAlgo('Seixo de Rio', 'Seixo de Rio N 0 a 3')).toBe(true);
    });

    it('esconde quando não há descrição', () => {
        expect(descricaoAcrescentaAlgo('Cimento', null)).toBe(false);
        expect(descricaoAcrescentaAlgo('Cimento', '  ')).toBe(false);
    });
});

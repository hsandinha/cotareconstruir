import { upsertSupplierMaterials } from '../lib/supplierMaterialsService';

const fornecedorId = '11111111-1111-4111-8111-111111111111';
const materialAllowed = '22222222-2222-4222-8222-222222222222';
const materialDenied = '33333333-3333-4333-8333-333333333333';
const fabricanteId = '44444444-4444-4444-8444-444444444444';

class MockQuery {
    private filters: Array<{ type: 'eq' | 'in' | 'gte'; field: string; value: any }> = [];
    private action: 'select' | 'upsert' = 'select';
    private payload: any[] = [];

    constructor(private table: string, private db: any) { }

    select() {
        return this;
    }

    eq(field: string, value: any) {
        this.filters.push({ type: 'eq', field, value });
        return this;
    }

    in(field: string, value: any[]) {
        this.filters.push({ type: 'in', field, value });
        return this;
    }

    gte(field: string, value: any) {
        this.filters.push({ type: 'gte', field, value });
        return this;
    }

    order() {
        return this;
    }

    range() {
        return this;
    }

    upsert(payload: any[]) {
        this.action = 'upsert';
        this.payload = payload;
        this.db.upsertPayload = payload;
        return this;
    }

    then(resolve: (value: any) => any, reject: (error: any) => any) {
        return Promise.resolve(this.execute()).then(resolve, reject);
    }

    private execute() {
        if (this.action === 'upsert') {
            return { data: this.payload.map((row) => ({ id: `fm-${row.material_id}`, ...row })), error: null };
        }

        let data = [...(this.db[this.table] || [])];
        for (const filter of this.filters) {
            if (filter.type === 'eq') {
                data = data.filter((row) => row[filter.field] === filter.value);
            }
            if (filter.type === 'in') {
                data = data.filter((row) => filter.value.includes(row[filter.field]));
            }
            if (filter.type === 'gte') {
                data = data.filter((row) => String(row[filter.field]) >= String(filter.value));
            }
        }

        return { data, error: null, count: data.length };
    }
}

function createMockSupabase(overrides: Record<string, any[]> = {}) {
    const db: any = {
        fornecedor_grupo: [{ fornecedor_id: fornecedorId, grupo_id: 'grupo-a' }],
        materiais: [
            { id: materialAllowed, nome: 'Cimento', unidade: 'saco', descricao: null },
            { id: materialDenied, nome: 'Areia', unidade: 'm3', descricao: null },
        ],
        material_grupo: [
            { material_id: materialAllowed, grupo_id: 'grupo-a' },
            { material_id: materialDenied, grupo_id: 'grupo-b' },
        ],
        fornecedor_fabricante: [],
        fornecedor_materiais: [],
        ...overrides,
        upsertPayload: null,
    };

    return {
        db,
        supabase: {
            from(table: string) {
                return new MockQuery(table, db);
            },
        },
    };
}

describe('upsertSupplierMaterials', () => {
    it('accepts allowed materials, rejects materials outside supplier groups, and uses the last duplicate', async () => {
        const { supabase, db } = createMockSupabase();

        const result = await upsertSupplierMaterials(supabase, {
            fornecedorId,
            items: [
                { material_id: materialAllowed, preco: 10, estoque: 1, ativo: true },
                { material_id: materialDenied, preco: 7, estoque: 2, ativo: true },
                { material_id: materialAllowed, preco: 20, estoque: 3, ativo: false },
            ],
        });

        expect(result.accepted_count).toBe(1);
        expect(result.rejected_count).toBe(1);
        expect(result.deduplicated_count).toBe(1);
        expect(result.results).toEqual(expect.arrayContaining([
            expect.objectContaining({ material_id: materialDenied, status: 'rejected', code: 'material_not_allowed' }),
            expect.objectContaining({ material_id: materialAllowed, status: 'upserted', operation: 'insert' }),
        ]));
        expect(db.upsertPayload).toHaveLength(1);
        expect(db.upsertPayload[0]).toEqual(expect.objectContaining({
            material_id: materialAllowed,
            preco: 20,
            estoque: 3,
            ativo: false,
        }));
    });

    it('validates dry runs without writing', async () => {
        const { supabase, db } = createMockSupabase();

        const result = await upsertSupplierMaterials(supabase, {
            fornecedorId,
            dryRun: true,
            items: [{ material_id: materialAllowed, preco: 10, estoque: 1, ativo: true }],
        });

        expect(result.dry_run).toBe(true);
        expect(result.accepted_count).toBe(1);
        expect(result.updated_count).toBe(0);
        expect(result.results[0]).toEqual(expect.objectContaining({ status: 'validated' }));
        expect(db.upsertPayload).toBeNull();
    });

    it('preserves omitted fields when updating existing rows', async () => {
        const { supabase, db } = createMockSupabase({
            fornecedor_materiais: [{
                id: 'fm-1',
                fornecedor_id: fornecedorId,
                material_id: materialAllowed,
                preco: 99,
                preco_promocional: 88,
                estoque: 12,
                estoque_minimo: 2,
                marca: 'Marca atual',
                fabricante_id: null,
                codigo_sku: 'SKU-1',
                descricao: 'Descrição atual',
                ativo: true,
            }],
        });

        const result = await upsertSupplierMaterials(supabase, {
            fornecedorId,
            items: [{ material_id: materialAllowed, ativo: false }],
        });

        expect(result.accepted_count).toBe(1);
        expect(db.upsertPayload[0]).toEqual(expect.objectContaining({
            material_id: materialAllowed,
            preco: 99,
            preco_promocional: 88,
            estoque: 12,
            estoque_minimo: 2,
            marca: 'Marca atual',
            codigo_sku: 'SKU-1',
            descricao: 'Descrição atual',
            ativo: false,
        }));
    });

    it('rejects manufacturers not linked to the supplier', async () => {
        const { supabase } = createMockSupabase();

        const result = await upsertSupplierMaterials(supabase, {
            fornecedorId,
            items: [{ material_id: materialAllowed, preco: 10, estoque: 1, fabricante_id: fabricanteId }],
        });

        expect(result.accepted_count).toBe(0);
        expect(result.rejected_count).toBe(1);
        expect(result.results[0]).toEqual(expect.objectContaining({
            material_id: materialAllowed,
            status: 'rejected',
            code: 'manufacturer_not_allowed',
        }));
    });
});

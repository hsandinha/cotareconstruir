import { createSupplierOffer } from '../lib/supplierOffersService';
import { createSupplierStockMovements } from '../lib/supplierStockService';
import { createSupplierWebhook } from '../lib/supplierWebhooksService';

const fornecedorId = '11111111-1111-4111-8111-111111111111';
const materialId = '22222222-2222-4222-8222-222222222222';
const fornecedorMaterialId = '33333333-3333-4333-8333-333333333333';

class MockQuery {
    private filters: Array<{ field: string; value: any }> = [];
    private action: 'select' | 'insert' | 'update' | 'delete' = 'select';
    private payload: any = null;

    constructor(private table: string, private db: any) { }

    select() {
        return this;
    }

    eq(field: string, value: any) {
        this.filters.push({ field, value });
        return this;
    }

    order() {
        return this;
    }

    range() {
        return this;
    }

    insert(payload: any) {
        this.action = 'insert';
        this.payload = Array.isArray(payload) ? payload : [payload];
        return this;
    }

    update(payload: any) {
        this.action = 'update';
        this.payload = payload;
        return this;
    }

    delete() {
        this.action = 'delete';
        return this;
    }

    async maybeSingle() {
        const result = this.execute();
        if (result.error) return result;
        return { data: result.data[0] || null, error: null };
    }

    async single() {
        const result = this.execute();
        if (result.error) return result;
        return { data: result.data[0] || null, error: null };
    }

    then(resolve: (value: any) => any, reject: (error: any) => any) {
        return Promise.resolve(this.execute()).then(resolve, reject);
    }

    private rows() {
        return this.db[this.table] || [];
    }

    private matches(row: any) {
        return this.filters.every((filter) => row[filter.field] === filter.value);
    }

    private execute() {
        if (this.action === 'insert') {
            const inserted = this.payload.map((row: any, index: number) => ({
                id: row.id || `${this.table}-${this.rows().length + index + 1}`,
                created_at: row.created_at || new Date('2026-05-26T12:00:00.000Z').toISOString(),
                updated_at: row.updated_at || new Date('2026-05-26T12:00:00.000Z').toISOString(),
                ...row,
            }));
            this.db[this.table] = [...this.rows(), ...inserted];
            return { data: inserted, error: null, count: inserted.length };
        }

        if (this.action === 'update') {
            const updated: any[] = [];
            this.db[this.table] = this.rows().map((row: any) => {
                if (!this.matches(row)) return row;
                const next = { ...row, ...this.payload };
                updated.push(next);
                return next;
            });
            return { data: updated, error: null, count: updated.length };
        }

        if (this.action === 'delete') {
            const deleted = this.rows().filter((row: any) => this.matches(row));
            this.db[this.table] = this.rows().filter((row: any) => !this.matches(row));
            return { data: deleted, error: null, count: deleted.length };
        }

        const data = this.rows().filter((row: any) => this.matches(row));
        return { data, error: null, count: data.length };
    }
}

function createMockSupabase(overrides: Record<string, any[]> = {}) {
    const db: any = {
        fornecedor_materiais: [
            {
                id: fornecedorMaterialId,
                fornecedor_id: fornecedorId,
                material_id: materialId,
                preco: 100,
                estoque: 20,
                ativo: true,
                material: { id: materialId, nome: 'Cimento', unidade: 'saco' },
            },
        ],
        ofertas: [],
        fornecedor_estoque_movimentacoes: [],
        fornecedor_webhook_endpoints: [],
        ...overrides,
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

describe('supplier API extension services', () => {
    it('creates offers using the supplier material price and server-side discount calculation', async () => {
        const { supabase } = createMockSupabase();

        const offer = await createSupplierOffer(supabase, fornecedorId, {
            material_id: materialId,
            tipo_oferta: 'percentual',
            valor_oferta: 15,
            quantidade_minima: 2,
            estoque: 10,
        });

        expect(offer).toEqual(expect.objectContaining({
            fornecedor_id: fornecedorId,
            material_id: materialId,
            preco_original: 100,
            preco_final: 85,
            desconto_percentual: 15,
            ativo: true,
        }));
    });

    it('records stock movements and rejects movements that would make stock negative', async () => {
        const { supabase, db } = createMockSupabase();

        const result = await createSupplierStockMovements(supabase, {
            fornecedorId,
            movements: [
                { material_id: materialId, tipo: 'entrada', quantidade: 5, referencia: 'NF-1' },
                { material_id: materialId, tipo: 'saida', quantidade: 99 },
            ],
        });

        expect(result.accepted_count).toBe(1);
        expect(result.rejected_count).toBe(1);
        expect(db.fornecedor_materiais[0].estoque).toBe(25);
        expect(db.fornecedor_estoque_movimentacoes[0]).toEqual(expect.objectContaining({
            fornecedor_id: fornecedorId,
            material_id: materialId,
            estoque_anterior: 20,
            estoque_atual: 25,
            referencia_externa: 'NF-1',
        }));
        expect(result.results[1]).toEqual(expect.objectContaining({ status: 'rejected', code: 'insufficient_stock' }));
    });

    it('creates webhook endpoints and returns the secret only in the create response', async () => {
        const { supabase, db } = createMockSupabase();

        const result = await createSupplierWebhook(supabase, fornecedorId, {
            url: 'https://erp.example.com/webhooks/cotar',
            description: 'ERP produção',
            events: ['order.created', 'order.status_changed'],
        });

        expect(result.secret).toMatch(/^ccwhsec_/);
        expect(result.data).toEqual(expect.objectContaining({
            fornecedor_id: fornecedorId,
            url: 'https://erp.example.com/webhooks/cotar',
            events: ['order.created', 'order.status_changed'],
            ativo: true,
        }));
        expect(result.data).not.toHaveProperty('secret_hash');
        expect(db.fornecedor_webhook_endpoints[0].secret_hash).toEqual(expect.any(String));
    });
});

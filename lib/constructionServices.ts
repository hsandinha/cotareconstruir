import { supabase } from './supabase';
import {
    Fase,
    Servico,
    GrupoInsumo,
    Material,
} from './constructionData';

// ========== TABLES ==========
const TABLES = {
    FASES: 'fases',
    SERVICOS: 'servicos',
    GRUPOS_INSUMO: 'grupos_insumo',
    MATERIAIS: 'materiais',
    SERVICO_FASE: 'servico_fase',
    SERVICO_GRUPO: 'servico_grupo',
    MATERIAL_GRUPO: 'material_grupo',
} as const;

// ========== FASES ==========

export async function getFases(): Promise<Fase[]> {
    try {
        const { data, error } = await supabase
            .from(TABLES.FASES)
            .select('*')
            .order('cronologia', { ascending: true });

        if (error) throw error;
        return data as Fase[];
    } catch (error) {
        console.error('Erro ao buscar fases:', error);
        throw error;
    }
}

export async function getFaseById(id: string): Promise<Fase | null> {
    try {
        const { data, error } = await supabase
            .from(TABLES.FASES)
            .select('*')
            .eq('id', id)
            .single();

        if (error) {
            if (error.code === 'PGRST116') return null; // Not found
            throw error;
        }
        return data as Fase;
    } catch (error) {
        console.error('Erro ao buscar fase:', error);
        throw error;
    }
}

export async function createFase(data: Omit<Fase, 'id'>): Promise<string> {
    try {
        const { data: inserted, error } = await supabase
            .from(TABLES.FASES)
            .insert(data)
            .select('id')
            .single();

        if (error) throw error;
        return inserted.id;
    } catch (error) {
        console.error('Erro ao criar fase:', error);
        throw error;
    }
}

export async function updateFase(id: string, data: Partial<Fase>): Promise<void> {
    try {
        const { error } = await supabase
            .from(TABLES.FASES)
            .update(data)
            .eq('id', id);

        if (error) throw error;
    } catch (error) {
        console.error('Erro ao atualizar fase:', error);
        throw error;
    }
}

export async function deleteFase(id: string): Promise<void> {
    try {
        // Primeiro remove relacionamentos na tabela de junção
        await supabase.from(TABLES.SERVICO_FASE).delete().eq('fase_id', id);

        const { error } = await supabase
            .from(TABLES.FASES)
            .delete()
            .eq('id', id);

        if (error) throw error;
    } catch (error) {
        console.error('Erro ao deletar fase:', error);
        throw error;
    }
}

// ========== SERVIÇOS ==========

export async function getServicos(): Promise<Servico[]> {
    try {
        // Busca serviços
        const { data: servicos, error } = await supabase
            .from(TABLES.SERVICOS)
            .select('*');

        if (error) throw error;

        // Busca relacionamentos de fases
        const { data: servicoFases } = await supabase
            .from(TABLES.SERVICO_FASE)
            .select('servico_id, fase_id');

        // Busca relacionamentos de grupos
        const { data: servicoGrupos } = await supabase
            .from(TABLES.SERVICO_GRUPO)
            .select('servico_id, grupo_id');

        // Monta os objetos com os arrays de IDs
        return servicos.map(servico => ({
            ...servico,
            faseIds: servicoFases?.filter(sf => sf.servico_id === servico.id).map(sf => sf.fase_id) || [],
            gruposInsumoIds: servicoGrupos?.filter(sg => sg.servico_id === servico.id).map(sg => sg.grupo_id) || [],
        })) as Servico[];
    } catch (error) {
        console.error('Erro ao buscar serviços:', error);
        throw error;
    }
}

export async function getServicoById(id: string): Promise<Servico | null> {
    try {
        const { data: servico, error } = await supabase
            .from(TABLES.SERVICOS)
            .select('*')
            .eq('id', id)
            .single();

        if (error) {
            if (error.code === 'PGRST116') return null;
            throw error;
        }

        // Busca relacionamentos de fases
        const { data: servicoFases } = await supabase
            .from(TABLES.SERVICO_FASE)
            .select('fase_id')
            .eq('servico_id', id);

        // Busca relacionamentos de grupos
        const { data: servicoGrupos } = await supabase
            .from(TABLES.SERVICO_GRUPO)
            .select('grupo_id')
            .eq('servico_id', id);

        return {
            ...servico,
            faseIds: servicoFases?.map(sf => sf.fase_id) || [],
            gruposInsumoIds: servicoGrupos?.map(sg => sg.grupo_id) || [],
        } as Servico;
    } catch (error) {
        console.error('Erro ao buscar serviço:', error);
        throw error;
    }
}

export async function getServicosByFaseId(faseId: string): Promise<Servico[]> {
    try {
        // Busca serviços relacionados à fase pela tabela de junção
        const { data: servicoFases, error: junctionError } = await supabase
            .from(TABLES.SERVICO_FASE)
            .select('servico_id')
            .eq('fase_id', faseId);

        if (junctionError) throw junctionError;

        if (!servicoFases || servicoFases.length === 0) return [];

        const servicoIds = servicoFases.map(sf => sf.servico_id);

        const { data: servicos, error } = await supabase
            .from(TABLES.SERVICOS)
            .select('*')
            .in('id', servicoIds)
            .order('ordem', { ascending: true });

        if (error) throw error;

        // Busca todos os relacionamentos para esses serviços
        const { data: allServicoFases } = await supabase
            .from(TABLES.SERVICO_FASE)
            .select('servico_id, fase_id')
            .in('servico_id', servicoIds);

        const { data: allServicoGrupos } = await supabase
            .from(TABLES.SERVICO_GRUPO)
            .select('servico_id, grupo_id')
            .in('servico_id', servicoIds);

        return servicos.map(servico => ({
            ...servico,
            faseIds: allServicoFases?.filter(sf => sf.servico_id === servico.id).map(sf => sf.fase_id) || [],
            gruposInsumoIds: allServicoGrupos?.filter(sg => sg.servico_id === servico.id).map(sg => sg.grupo_id) || [],
        })) as Servico[];
    } catch (error) {
        console.error('Erro ao buscar serviços por fase:', error);
        throw error;
    }
}

export async function createServico(data: Omit<Servico, 'id'>): Promise<string> {
    try {
        const { faseIds, gruposInsumoIds, ...servicoData } = data;

        // Insere o serviço
        const { data: inserted, error } = await supabase
            .from(TABLES.SERVICOS)
            .insert(servicoData)
            .select('id')
            .single();

        if (error) throw error;

        const servicoId = inserted.id;

        // Insere relacionamentos com fases
        if (faseIds && faseIds.length > 0) {
            const faseRelations = faseIds.map(faseId => ({
                servico_id: servicoId,
                fase_id: faseId,
            }));
            await supabase.from(TABLES.SERVICO_FASE).insert(faseRelations);
        }

        // Insere relacionamentos com grupos
        if (gruposInsumoIds && gruposInsumoIds.length > 0) {
            const grupoRelations = gruposInsumoIds.map(grupoId => ({
                servico_id: servicoId,
                grupo_id: grupoId,
            }));
            await supabase.from(TABLES.SERVICO_GRUPO).insert(grupoRelations);
        }

        return servicoId;
    } catch (error) {
        console.error('Erro ao criar serviço:', error);
        throw error;
    }
}

export async function updateServico(id: string, data: Partial<Servico>): Promise<void> {
    try {
        const { faseIds, gruposInsumoIds, ...servicoData } = data;

        // Atualiza dados do serviço (se houver)
        if (Object.keys(servicoData).length > 0) {
            const { error } = await supabase
                .from(TABLES.SERVICOS)
                .update(servicoData)
                .eq('id', id);

            if (error) throw error;
        }

        // Atualiza relacionamentos com fases (se fornecido)
        if (faseIds !== undefined) {
            // Remove relacionamentos antigos
            await supabase.from(TABLES.SERVICO_FASE).delete().eq('servico_id', id);

            // Insere novos relacionamentos
            if (faseIds.length > 0) {
                const faseRelations = faseIds.map(faseId => ({
                    servico_id: id,
                    fase_id: faseId,
                }));
                await supabase.from(TABLES.SERVICO_FASE).insert(faseRelations);
            }
        }

        // Atualiza relacionamentos com grupos (se fornecido)
        if (gruposInsumoIds !== undefined) {
            // Remove relacionamentos antigos
            await supabase.from(TABLES.SERVICO_GRUPO).delete().eq('servico_id', id);

            // Insere novos relacionamentos
            if (gruposInsumoIds.length > 0) {
                const grupoRelations = gruposInsumoIds.map(grupoId => ({
                    servico_id: id,
                    grupo_id: grupoId,
                }));
                await supabase.from(TABLES.SERVICO_GRUPO).insert(grupoRelations);
            }
        }
    } catch (error) {
        console.error('Erro ao atualizar serviço:', error);
        throw error;
    }
}

export async function deleteServico(id: string): Promise<void> {
    try {
        // Remove relacionamentos nas tabelas de junção
        await supabase.from(TABLES.SERVICO_FASE).delete().eq('servico_id', id);
        await supabase.from(TABLES.SERVICO_GRUPO).delete().eq('servico_id', id);

        const { error } = await supabase
            .from(TABLES.SERVICOS)
            .delete()
            .eq('id', id);

        if (error) throw error;
    } catch (error) {
        console.error('Erro ao deletar serviço:', error);
        throw error;
    }
}

// ========== GRUPOS DE INSUMO ==========

export async function getGruposInsumo(): Promise<GrupoInsumo[]> {
    try {
        const { data, error } = await supabase
            .from(TABLES.GRUPOS_INSUMO)
            .select('*');

        if (error) throw error;
        return data as GrupoInsumo[];
    } catch (error) {
        console.error('Erro ao buscar grupos de insumo:', error);
        throw error;
    }
}

export async function getGrupoInsumoById(id: string): Promise<GrupoInsumo | null> {
    try {
        const { data, error } = await supabase
            .from(TABLES.GRUPOS_INSUMO)
            .select('*')
            .eq('id', id)
            .single();

        if (error) {
            if (error.code === 'PGRST116') return null;
            throw error;
        }
        return data as GrupoInsumo;
    } catch (error) {
        console.error('Erro ao buscar grupo de insumo:', error);
        throw error;
    }
}

export async function createGrupoInsumo(data: Omit<GrupoInsumo, 'id'>): Promise<string> {
    try {
        const { data: inserted, error } = await supabase
            .from(TABLES.GRUPOS_INSUMO)
            .insert(data)
            .select('id')
            .single();

        if (error) throw error;
        return inserted.id;
    } catch (error) {
        console.error('Erro ao criar grupo de insumo:', error);
        throw error;
    }
}

export async function updateGrupoInsumo(id: string, data: Partial<GrupoInsumo>): Promise<void> {
    try {
        const { error } = await supabase
            .from(TABLES.GRUPOS_INSUMO)
            .update(data)
            .eq('id', id);

        if (error) throw error;
    } catch (error) {
        console.error('Erro ao atualizar grupo de insumo:', error);
        throw error;
    }
}

export async function deleteGrupoInsumo(id: string): Promise<void> {
    try {
        // Remove relacionamentos nas tabelas de junção
        await supabase.from(TABLES.SERVICO_GRUPO).delete().eq('grupo_id', id);
        await supabase.from(TABLES.MATERIAL_GRUPO).delete().eq('grupo_id', id);

        const { error } = await supabase
            .from(TABLES.GRUPOS_INSUMO)
            .delete()
            .eq('id', id);

        if (error) throw error;
    } catch (error) {
        console.error('Erro ao deletar grupo de insumo:', error);
        throw error;
    }
}

// ========== MATERIAIS ==========

export async function getMateriais(): Promise<Material[]> {
    try {
        // Busca todos os materiais com paginação (Supabase limita a 1000 por request)
        let allMateriais: any[] = [];
        let from = 0;
        const pageSize = 1000;
        while (true) {
            const { data, error } = await supabase
                .from(TABLES.MATERIAIS)
                .select('*')
                .range(from, from + pageSize - 1);
            if (error) throw error;
            if (!data || data.length === 0) break;
            allMateriais = allMateriais.concat(data);
            if (data.length < pageSize) break;
            from += pageSize;
        }

        // Busca todos os relacionamentos de grupos com paginação
        let allMaterialGrupos: any[] = [];
        from = 0;
        while (true) {
            const { data, error } = await supabase
                .from(TABLES.MATERIAL_GRUPO)
                .select('material_id, grupo_id')
                .range(from, from + pageSize - 1);
            if (error) throw error;
            if (!data || data.length === 0) break;
            allMaterialGrupos = allMaterialGrupos.concat(data);
            if (data.length < pageSize) break;
            from += pageSize;
        }

        // Indexa os grupos por material_id para performance
        const gruposByMaterialId = new Map<string, string[]>();
        for (const mg of allMaterialGrupos) {
            const list = gruposByMaterialId.get(mg.material_id) || [];
            list.push(mg.grupo_id);
            gruposByMaterialId.set(mg.material_id, list);
        }

        // Monta os objetos com os arrays de IDs
        return allMateriais.map(material => ({
            ...material,
            gruposInsumoIds: gruposByMaterialId.get(material.id) || [],
        })) as Material[];
    } catch (error) {
        console.error('Erro ao buscar materiais:', error);
        throw error;
    }
}

export async function getMaterialById(id: string): Promise<Material | null> {
    try {
        const { data: material, error } = await supabase
            .from(TABLES.MATERIAIS)
            .select('*')
            .eq('id', id)
            .single();

        if (error) {
            if (error.code === 'PGRST116') return null;
            throw error;
        }

        // Busca relacionamentos de grupos
        const { data: materialGrupos } = await supabase
            .from(TABLES.MATERIAL_GRUPO)
            .select('grupo_id')
            .eq('material_id', id);

        return {
            ...material,
            gruposInsumoIds: materialGrupos?.map(mg => mg.grupo_id) || [],
        } as Material;
    } catch (error) {
        console.error('Erro ao buscar material:', error);
        throw error;
    }
}

export async function getMateriaisByGrupoId(grupoId: string): Promise<Material[]> {
    try {
        // Busca materiais relacionados ao grupo pela tabela de junção
        const { data: materialGrupos, error: junctionError } = await supabase
            .from(TABLES.MATERIAL_GRUPO)
            .select('material_id')
            .eq('grupo_id', grupoId);

        if (junctionError) throw junctionError;

        if (!materialGrupos || materialGrupos.length === 0) return [];

        const materialIds = materialGrupos.map(mg => mg.material_id);

        const { data: materiais, error } = await supabase
            .from(TABLES.MATERIAIS)
            .select('*')
            .in('id', materialIds);

        if (error) throw error;

        // Busca todos os relacionamentos para esses materiais
        const { data: allMaterialGrupos } = await supabase
            .from(TABLES.MATERIAL_GRUPO)
            .select('material_id, grupo_id')
            .in('material_id', materialIds);

        return materiais.map(material => ({
            ...material,
            gruposInsumoIds: allMaterialGrupos?.filter(mg => mg.material_id === material.id).map(mg => mg.grupo_id) || [],
        })) as Material[];
    } catch (error) {
        console.error('Erro ao buscar materiais por grupo:', error);
        throw error;
    }
}

export async function createMaterial(data: Omit<Material, 'id'>): Promise<string> {
    try {
        const { gruposInsumoIds, ...materialData } = data;

        // Insere o material
        const { data: inserted, error } = await supabase
            .from(TABLES.MATERIAIS)
            .insert(materialData)
            .select('id')
            .single();

        if (error) throw error;

        const materialId = inserted.id;

        // Insere relacionamentos com grupos
        if (gruposInsumoIds && gruposInsumoIds.length > 0) {
            const grupoRelations = gruposInsumoIds.map(grupoId => ({
                material_id: materialId,
                grupo_id: grupoId,
            }));
            await supabase.from(TABLES.MATERIAL_GRUPO).insert(grupoRelations);
        }

        return materialId;
    } catch (error) {
        console.error('Erro ao criar material:', error);
        throw error;
    }
}

export async function updateMaterial(id: string, data: Partial<Material>): Promise<void> {
    try {
        const { gruposInsumoIds, ...materialData } = data;

        // Atualiza dados do material (se houver)
        if (Object.keys(materialData).length > 0) {
            const { error } = await supabase
                .from(TABLES.MATERIAIS)
                .update(materialData)
                .eq('id', id);

            if (error) throw error;
        }

        // Atualiza relacionamentos com grupos (se fornecido)
        if (gruposInsumoIds !== undefined) {
            // Remove relacionamentos antigos
            await supabase.from(TABLES.MATERIAL_GRUPO).delete().eq('material_id', id);

            // Insere novos relacionamentos
            if (gruposInsumoIds.length > 0) {
                const grupoRelations = gruposInsumoIds.map(grupoId => ({
                    material_id: id,
                    grupo_id: grupoId,
                }));
                await supabase.from(TABLES.MATERIAL_GRUPO).insert(grupoRelations);
            }
        }
    } catch (error) {
        console.error('Erro ao atualizar material:', error);
        throw error;
    }
}

export async function deleteMaterial(id: string): Promise<void> {
    try {
        // Remove relacionamentos na tabela de junção
        await supabase.from(TABLES.MATERIAL_GRUPO).delete().eq('material_id', id);

        const { error } = await supabase
            .from(TABLES.MATERIAIS)
            .delete()
            .eq('id', id);

        if (error) throw error;
    } catch (error) {
        console.error('Erro ao deletar material:', error);
        throw error;
    }
}

// ========== RELACIONAMENTOS ==========

/**
 * Busca serviços associados a um grupo de insumo
 */
export async function getServicosByGrupoInsumoId(grupoId: string): Promise<Servico[]> {
    try {
        // Busca serviços relacionados ao grupo pela tabela de junção
        const { data: servicoGrupos, error: junctionError } = await supabase
            .from(TABLES.SERVICO_GRUPO)
            .select('servico_id')
            .eq('grupo_id', grupoId);

        if (junctionError) throw junctionError;

        if (!servicoGrupos || servicoGrupos.length === 0) return [];

        const servicoIds = servicoGrupos.map(sg => sg.servico_id);

        const { data: servicos, error } = await supabase
            .from(TABLES.SERVICOS)
            .select('*')
            .in('id', servicoIds);

        if (error) throw error;

        // Busca todos os relacionamentos para esses serviços
        const { data: allServicoFases } = await supabase
            .from(TABLES.SERVICO_FASE)
            .select('servico_id, fase_id')
            .in('servico_id', servicoIds);

        const { data: allServicoGrupos } = await supabase
            .from(TABLES.SERVICO_GRUPO)
            .select('servico_id, grupo_id')
            .in('servico_id', servicoIds);

        return servicos.map(servico => ({
            ...servico,
            faseIds: allServicoFases?.filter(sf => sf.servico_id === servico.id).map(sf => sf.fase_id) || [],
            gruposInsumoIds: allServicoGrupos?.filter(sg => sg.servico_id === servico.id).map(sg => sg.grupo_id) || [],
        })) as Servico[];
    } catch (error) {
        console.error('Erro ao buscar serviços por grupo:', error);
        throw error;
    }
}

/**
 * Busca fases associadas a um grupo de insumo (via serviços)
 */
export async function getFasesByGrupoInsumoId(grupoId: string): Promise<Fase[]> {
    try {
        // Primeiro busca os serviços do grupo
        const servicos = await getServicosByGrupoInsumoId(grupoId);

        // Coleta todos os faseIds únicos
        const faseIdsSet = new Set<string>();
        servicos.forEach(servico => {
            servico.faseIds.forEach(faseId => faseIdsSet.add(faseId));
        });

        // Busca as fases
        const fases: Fase[] = [];
        for (const faseId of faseIdsSet) {
            const fase = await getFaseById(faseId);
            if (fase) fases.push(fase);
        }

        // Ordena por cronologia
        return fases.sort((a, b) => a.cronologia - b.cronologia);
    } catch (error) {
        console.error('Erro ao buscar fases por grupo:', error);
        throw error;
    }
}

// ========== ATUALIZAÇÃO DE RELACIONAMENTOS ==========

/**
 * Adiciona uma fase a um serviço (se ainda não estiver associada)
 */
export async function addFaseToServico(servicoId: string, faseId: string): Promise<void> {
    try {
        // Verifica se já existe o relacionamento
        const { data: existing } = await supabase
            .from(TABLES.SERVICO_FASE)
            .select('*')
            .eq('servico_id', servicoId)
            .eq('fase_id', faseId)
            .single();

        if (existing) {
            console.log('Fase já está associada ao serviço');
            return;
        }

        // Adiciona o relacionamento
        const { error } = await supabase
            .from(TABLES.SERVICO_FASE)
            .insert({ servico_id: servicoId, fase_id: faseId });

        if (error) throw error;
    } catch (error) {
        console.error('Erro ao adicionar fase ao serviço:', error);
        throw error;
    }
}

/**
 * Remove uma fase de um serviço
 */
export async function removeFaseFromServico(servicoId: string, faseId: string): Promise<void> {
    try {
        const { error } = await supabase
            .from(TABLES.SERVICO_FASE)
            .delete()
            .eq('servico_id', servicoId)
            .eq('fase_id', faseId);

        if (error) throw error;
    } catch (error) {
        console.error('Erro ao remover fase do serviço:', error);
        throw error;
    }
}

/**
 * Adiciona um grupo de insumo a um serviço (se ainda não estiver associado)
 */
export async function addGrupoToServico(servicoId: string, grupoId: string): Promise<void> {
    try {
        // Verifica se já existe o relacionamento
        const { data: existing } = await supabase
            .from(TABLES.SERVICO_GRUPO)
            .select('*')
            .eq('servico_id', servicoId)
            .eq('grupo_id', grupoId)
            .single();

        if (existing) {
            console.log('Grupo já está associado ao serviço');
            return;
        }

        // Adiciona o relacionamento
        const { error } = await supabase
            .from(TABLES.SERVICO_GRUPO)
            .insert({ servico_id: servicoId, grupo_id: grupoId });

        if (error) throw error;
    } catch (error) {
        console.error('Erro ao adicionar grupo ao serviço:', error);
        throw error;
    }
}

/**
 * Remove um grupo de insumo de um serviço
 */
export async function removeGrupoFromServico(servicoId: string, grupoId: string): Promise<void> {
    try {
        const { error } = await supabase
            .from(TABLES.SERVICO_GRUPO)
            .delete()
            .eq('servico_id', servicoId)
            .eq('grupo_id', grupoId);

        if (error) throw error;
    } catch (error) {
        console.error('Erro ao remover grupo do serviço:', error);
        throw error;
    }
}

/**
 * Adiciona um grupo de insumo a um material (se ainda não estiver associado)
 */
export async function addGrupoToMaterial(materialId: string, grupoId: string): Promise<void> {
    try {
        // Verifica se já existe o relacionamento
        const { data: existing } = await supabase
            .from(TABLES.MATERIAL_GRUPO)
            .select('*')
            .eq('material_id', materialId)
            .eq('grupo_id', grupoId)
            .single();

        if (existing) {
            console.log('Grupo já está associado ao material');
            return;
        }

        // Adiciona o relacionamento
        const { error } = await supabase
            .from(TABLES.MATERIAL_GRUPO)
            .insert({ material_id: materialId, grupo_id: grupoId });

        if (error) throw error;
    } catch (error) {
        console.error('Erro ao adicionar grupo ao material:', error);
        throw error;
    }
}

/**
 * Remove um grupo de insumo de um material
 */
export async function removeGrupoFromMaterial(materialId: string, grupoId: string): Promise<void> {
    try {
        const { error } = await supabase
            .from(TABLES.MATERIAL_GRUPO)
            .delete()
            .eq('material_id', materialId)
            .eq('grupo_id', grupoId);

        if (error) throw error;
    } catch (error) {
        console.error('Erro ao remover grupo do material:', error);
        throw error;
    }
}

// ========== VERIFICAÇÃO ==========

/**
 * Verifica se o banco já foi inicializado
 */
export async function isDatabaseInitialized(): Promise<boolean> {
    try {
        const { data, error } = await supabase
            .from(TABLES.FASES)
            .select('id')
            .limit(1);

        if (error) throw error;
        return data && data.length > 0;
    } catch (error) {
        console.error('Erro ao verificar se banco está inicializado:', error);
        return false;
    }
}


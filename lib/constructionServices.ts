import {
    collection,
    doc,
    getDoc,
    getDocs,
    addDoc,
    updateDoc,
    deleteDoc,
    query,
    where,
    orderBy,
    Timestamp,
    writeBatch
} from 'firebase/firestore';
import { db } from './firebase';
import {
    Fase,
    Servico,
    GrupoInsumo,
    Material,
} from './constructionData';



// ========== COLLECTIONS ==========
const COLLECTIONS = {
    FASES: 'fases',
    SERVICOS: 'servicos',
    GRUPOS_INSUMO: 'grupos_insumo',
    MATERIAIS: 'materiais',
} as const;

// ========== FASES ==========

export async function getFases(): Promise<Fase[]> {
    try {
        const q = query(collection(db, COLLECTIONS.FASES), orderBy('cronologia', 'asc'));
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Fase));
    } catch (error) {
        console.error('Erro ao buscar fases:', error);
        throw error;
    }
}

export async function getFaseById(id: string): Promise<Fase | null> {
    try {
        const docRef = doc(db, COLLECTIONS.FASES, id);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
            return { id: docSnap.id, ...docSnap.data() } as Fase;
        }
        return null;
    } catch (error) {
        console.error('Erro ao buscar fase:', error);
        throw error;
    }
}

export async function createFase(data: Omit<Fase, 'id'>): Promise<string> {
    try {
        const docRef = await addDoc(collection(db, COLLECTIONS.FASES), data);
        return docRef.id;
    } catch (error) {
        console.error('Erro ao criar fase:', error);
        throw error;
    }
}

export async function updateFase(id: string, data: Partial<Fase>): Promise<void> {
    try {
        const docRef = doc(db, COLLECTIONS.FASES, id);
        await updateDoc(docRef, data);
    } catch (error) {
        console.error('Erro ao atualizar fase:', error);
        throw error;
    }
}

export async function deleteFase(id: string): Promise<void> {
    try {
        const docRef = doc(db, COLLECTIONS.FASES, id);
        await deleteDoc(docRef);
    } catch (error) {
        console.error('Erro ao deletar fase:', error);
        throw error;
    }
}

// ========== SERVIÇOS ==========

export async function getServicos(): Promise<Servico[]> {
    try {
        const snapshot = await getDocs(collection(db, COLLECTIONS.SERVICOS));
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Servico));
    } catch (error) {
        console.error('Erro ao buscar serviços:', error);
        throw error;
    }
}

export async function getServicoById(id: string): Promise<Servico | null> {
    try {
        const docRef = doc(db, COLLECTIONS.SERVICOS, id);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
            return { id: docSnap.id, ...docSnap.data() } as Servico;
        }
        return null;
    } catch (error) {
        console.error('Erro ao buscar serviço:', error);
        throw error;
    }
}

export async function getServicosByFaseId(faseId: string): Promise<Servico[]> {
    try {
        const q = query(
            collection(db, COLLECTIONS.SERVICOS),
            where('faseIds', 'array-contains', faseId),
            orderBy('ordem', 'asc')
        );
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Servico));
    } catch (error) {
        console.error('Erro ao buscar serviços por fase:', error);
        throw error;
    }
}

export async function createServico(data: Omit<Servico, 'id'>): Promise<string> {
    try {
        const docRef = await addDoc(collection(db, COLLECTIONS.SERVICOS), data);
        return docRef.id;
    } catch (error) {
        console.error('Erro ao criar serviço:', error);
        throw error;
    }
}

export async function updateServico(id: string, data: Partial<Servico>): Promise<void> {
    try {
        const docRef = doc(db, COLLECTIONS.SERVICOS, id);
        await updateDoc(docRef, data);
    } catch (error) {
        console.error('Erro ao atualizar serviço:', error);
        throw error;
    }
}

export async function deleteServico(id: string): Promise<void> {
    try {
        const docRef = doc(db, COLLECTIONS.SERVICOS, id);
        await deleteDoc(docRef);
    } catch (error) {
        console.error('Erro ao deletar serviço:', error);
        throw error;
    }
}

// ========== GRUPOS DE INSUMO ==========

export async function getGruposInsumo(): Promise<GrupoInsumo[]> {
    try {
        const snapshot = await getDocs(collection(db, COLLECTIONS.GRUPOS_INSUMO));
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as GrupoInsumo));
    } catch (error) {
        console.error('Erro ao buscar grupos de insumo:', error);
        throw error;
    }
}

export async function getGrupoInsumoById(id: string): Promise<GrupoInsumo | null> {
    try {
        const docRef = doc(db, COLLECTIONS.GRUPOS_INSUMO, id);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
            return { id: docSnap.id, ...docSnap.data() } as GrupoInsumo;
        }
        return null;
    } catch (error) {
        console.error('Erro ao buscar grupo de insumo:', error);
        throw error;
    }
}

export async function createGrupoInsumo(data: Omit<GrupoInsumo, 'id'>): Promise<string> {
    try {
        const docRef = await addDoc(collection(db, COLLECTIONS.GRUPOS_INSUMO), data);
        return docRef.id;
    } catch (error) {
        console.error('Erro ao criar grupo de insumo:', error);
        throw error;
    }
}

export async function updateGrupoInsumo(id: string, data: Partial<GrupoInsumo>): Promise<void> {
    try {
        const docRef = doc(db, COLLECTIONS.GRUPOS_INSUMO, id);
        await updateDoc(docRef, data);
    } catch (error) {
        console.error('Erro ao atualizar grupo de insumo:', error);
        throw error;
    }
}

export async function deleteGrupoInsumo(id: string): Promise<void> {
    try {
        const docRef = doc(db, COLLECTIONS.GRUPOS_INSUMO, id);
        await deleteDoc(docRef);
    } catch (error) {
        console.error('Erro ao deletar grupo de insumo:', error);
        throw error;
    }
}

// ========== MATERIAIS ==========

export async function getMateriais(): Promise<Material[]> {
    try {
        const snapshot = await getDocs(collection(db, COLLECTIONS.MATERIAIS));
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Material));
    } catch (error) {
        console.error('Erro ao buscar materiais:', error);
        throw error;
    }
}

export async function getMaterialById(id: string): Promise<Material | null> {
    try {
        const docRef = doc(db, COLLECTIONS.MATERIAIS, id);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
            return { id: docSnap.id, ...docSnap.data() } as Material;
        }
        return null;
    } catch (error) {
        console.error('Erro ao buscar material:', error);
        throw error;
    }
}

export async function getMateriaisByGrupoId(grupoId: string): Promise<Material[]> {
    try {
        const q = query(
            collection(db, COLLECTIONS.MATERIAIS),
            where('gruposInsumoIds', 'array-contains', grupoId)
        );
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Material));
    } catch (error) {
        console.error('Erro ao buscar materiais por grupo:', error);
        throw error;
    }
}

export async function createMaterial(data: Omit<Material, 'id'>): Promise<string> {
    try {
        const docRef = await addDoc(collection(db, COLLECTIONS.MATERIAIS), data);
        return docRef.id;
    } catch (error) {
        console.error('Erro ao criar material:', error);
        throw error;
    }
}

export async function updateMaterial(id: string, data: Partial<Material>): Promise<void> {
    try {
        const docRef = doc(db, COLLECTIONS.MATERIAIS, id);
        await updateDoc(docRef, data);
    } catch (error) {
        console.error('Erro ao atualizar material:', error);
        throw error;
    }
}

export async function deleteMaterial(id: string): Promise<void> {
    try {
        const docRef = doc(db, COLLECTIONS.MATERIAIS, id);
        await deleteDoc(docRef);
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
        const q = query(
            collection(db, COLLECTIONS.SERVICOS),
            where('gruposInsumoIds', 'array-contains', grupoId)
        );
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Servico));
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
        const servico = await getServicoById(servicoId);
        if (!servico) {
            throw new Error('Serviço não encontrado');
        }

        // Verifica se a fase já está associada
        if (servico.faseIds.includes(faseId)) {
            console.log('Fase já está associada ao serviço');
            return;
        }

        // Adiciona a nova fase
        const novasFases = [...servico.faseIds, faseId];
        await updateServico(servicoId, { faseIds: novasFases });
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
        const servico = await getServicoById(servicoId);
        if (!servico) {
            throw new Error('Serviço não encontrado');
        }

        // Remove a fase
        const novasFases = servico.faseIds.filter(id => id !== faseId);
        await updateServico(servicoId, { faseIds: novasFases });
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
        const servico = await getServicoById(servicoId);
        if (!servico) {
            throw new Error('Serviço não encontrado');
        }

        // Verifica se o grupo já está associado
        if (servico.gruposInsumoIds.includes(grupoId)) {
            console.log('Grupo já está associado ao serviço');
            return;
        }

        // Adiciona o novo grupo
        const novosGrupos = [...servico.gruposInsumoIds, grupoId];
        await updateServico(servicoId, { gruposInsumoIds: novosGrupos });
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
        const servico = await getServicoById(servicoId);
        if (!servico) {
            throw new Error('Serviço não encontrado');
        }

        // Remove o grupo
        const novosGrupos = servico.gruposInsumoIds.filter(id => id !== grupoId);
        await updateServico(servicoId, { gruposInsumoIds: novosGrupos });
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
        const material = await getMaterialById(materialId);
        if (!material) {
            throw new Error('Material não encontrado');
        }

        // Verifica se o grupo já está associado
        if (material.gruposInsumoIds.includes(grupoId)) {
            console.log('Grupo já está associado ao material');
            return;
        }

        // Adiciona o novo grupo
        const novosGrupos = [...material.gruposInsumoIds, grupoId];
        await updateMaterial(materialId, { gruposInsumoIds: novosGrupos });
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
        const material = await getMaterialById(materialId);
        if (!material) {
            throw new Error('Material não encontrado');
        }

        // Remove o grupo
        const novosGrupos = material.gruposInsumoIds.filter(id => id !== grupoId);
        await updateMaterial(materialId, { gruposInsumoIds: novosGrupos });
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
        const fasesSnapshot = await getDocs(collection(db, COLLECTIONS.FASES));
        return !fasesSnapshot.empty;
    } catch (error) {
        console.error('Erro ao verificar se banco está inicializado:', error);
        return false;
    }
}

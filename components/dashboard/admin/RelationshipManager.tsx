'use client';

import { useState, useEffect } from 'react';
import {
    getFases,
    getServicos,
    getGruposInsumo,
    getMateriais,
    addFaseToServico,
    removeFaseFromServico,
    addGrupoToServico,
    removeGrupoFromServico,
    addGrupoToMaterial,
    removeGrupoFromMaterial,
} from '@/lib/constructionServices';
import type { Fase, Servico, GrupoInsumo, Material } from '@/lib/constructionData';
import { supabase } from '@/lib/supabase';

type ViewMode = 'fase' | 'servico' | 'grupo' | 'fornecedor';

interface Fornecedor {
    id: string;
    razaoSocial: string;
    grupoInsumos: string | null;
    grupoInsumoIds?: string[];
}

export default function RelationshipManager() {
    const [fases, setFases] = useState<Fase[]>([]);
    const [servicos, setServicos] = useState<Servico[]>([]);
    const [grupos, setGrupos] = useState<GrupoInsumo[]>([]);
    const [materiais, setMateriais] = useState<Material[]>([]);
    const [fornecedores, setFornecedores] = useState<Fornecedor[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    // Modo de visualização
    const [viewMode, setViewMode] = useState<ViewMode>('servico');

    // Seleções para cada modo
    const [selectedFase, setSelectedFase] = useState<string>('');
    const [selectedServico, setSelectedServico] = useState<string>('');
    const [selectedGrupo, setSelectedGrupo] = useState<string>('');
    const [selectedFornecedor, setSelectedFornecedor] = useState<string>('');

    // Para adicionar
    const [selectedFaseToAdd, setSelectedFaseToAdd] = useState<string>('');
    const [selectedServicoToAdd, setSelectedServicoToAdd] = useState<string>('');
    const [selectedGrupoToAdd, setSelectedGrupoToAdd] = useState<string>('');
    const [selectedMaterialToAdd, setSelectedMaterialToAdd] = useState<string>('');

    useEffect(() => {
        loadData();
    }, []);

    async function loadData() {
        try {
            setLoading(true);
            const [fasesData, servicosData, gruposData, materiaisData] = await Promise.all([
                getFases(),
                getServicos(),
                getGruposInsumo(),
                getMateriais(),
            ]);
            setFases(fasesData);
            setServicos(servicosData);
            setGrupos(gruposData);
            setMateriais(materiaisData);

            // Carregar fornecedores do Supabase
            const { data: fornecedoresData, error: fornecedoresError } = await supabase
                .from('fornecedores')
                .select('id, razao_social');

            if (fornecedoresError) {
                console.error('Erro ao carregar fornecedores:', fornecedoresError);
                return;
            }

            // Carregar relacionamentos fornecedor_grupo
            const { data: fornecedorGrupoData, error: fgError } = await supabase
                .from('fornecedor_grupo')
                .select('fornecedor_id, grupo_id');

            if (fgError) {
                console.error('Erro ao carregar relacionamentos fornecedor_grupo:', fgError);
            }

            // Mapear grupos para cada fornecedor
            const fornecedoresComGrupos = (fornecedoresData || []).map(f => {
                const grupoIds = (fornecedorGrupoData || [])
                    .filter(fg => fg.fornecedor_id === f.id)
                    .map(fg => fg.grupo_id);
                return {
                    id: f.id,
                    razaoSocial: f.razao_social,
                    grupoInsumos: null,
                    grupoInsumoIds: grupoIds,
                };
            }) as Fornecedor[];
            setFornecedores(fornecedoresComGrupos);
        } catch (error) {
            console.error('Erro ao carregar dados:', error);
        } finally {
            setLoading(false);
        }
    }

    // Obter entidade selecionada conforme modo
    const currentServico = servicos.find((s) => s.id === selectedServico);
    const currentFase = fases.find((f) => f.id === selectedFase);
    const currentGrupo = grupos.find((g) => g.id === selectedGrupo);
    const currentFornecedor = fornecedores.find((f) => f.id === selectedFornecedor);

    // === MODO FASE: Associar serviços à fase ===
    const servicosNaFase = servicos.filter((s) => s.faseIds?.includes(selectedFase));
    const servicosDisponiveis = servicos.filter((s) => !s.faseIds?.includes(selectedFase));

    const handleAddServicoToFase = async () => {
        if (!selectedFase || !selectedServicoToAdd) return;
        try {
            setSaving(true);
            await addFaseToServico(selectedServicoToAdd, selectedFase);
            await loadData();
            setSelectedServicoToAdd('');
        } catch (error) {
            console.error('Erro ao adicionar serviço à fase:', error);
        } finally {
            setSaving(false);
        }
    };

    const handleRemoveServicoFromFase = async (servicoId: string) => {
        if (!selectedFase) return;
        try {
            setSaving(true);
            await removeFaseFromServico(servicoId, selectedFase);
            await loadData();
        } catch (error) {
            console.error('Erro ao remover serviço da fase:', error);
        } finally {
            setSaving(false);
        }
    };

    // === MODO SERVICO: Associar fases e grupos ao serviço ===
    const fasesDoServico = currentServico?.faseIds?.map((id) => fases.find((f) => f.id === id)).filter(Boolean) as Fase[] || [];
    const gruposDoServico = currentServico?.gruposInsumoIds?.map((id) => grupos.find((g) => g.id === id)).filter(Boolean) as GrupoInsumo[] || [];
    const fasesDisponiveisServico = fases.filter((f) => !currentServico?.faseIds?.includes(f.id));
    const gruposDisponiveisServico = grupos.filter((g) => !currentServico?.gruposInsumoIds?.includes(g.id));

    const handleAddFaseToServico = async () => {
        if (!selectedServico || !selectedFaseToAdd) return;
        try {
            setSaving(true);
            await addFaseToServico(selectedServico, selectedFaseToAdd);
            await loadData();
            setSelectedFaseToAdd('');
        } catch (error) {
            console.error('Erro ao adicionar fase ao serviço:', error);
        } finally {
            setSaving(false);
        }
    };

    const handleRemoveFaseFromServico = async (faseId: string) => {
        if (!selectedServico) return;
        try {
            setSaving(true);
            await removeFaseFromServico(selectedServico, faseId);
            await loadData();
        } catch (error) {
            console.error('Erro ao remover fase do serviço:', error);
        } finally {
            setSaving(false);
        }
    };

    const handleAddGrupoToServico = async () => {
        if (!selectedServico || !selectedGrupoToAdd) return;
        try {
            setSaving(true);
            await addGrupoToServico(selectedServico, selectedGrupoToAdd);
            await loadData();
            setSelectedGrupoToAdd('');
        } catch (error) {
            console.error('Erro ao adicionar grupo ao serviço:', error);
        } finally {
            setSaving(false);
        }
    };

    const handleRemoveGrupoFromServico = async (grupoId: string) => {
        if (!selectedServico) return;
        try {
            setSaving(true);
            await removeGrupoFromServico(selectedServico, grupoId);
            await loadData();
        } catch (error) {
            console.error('Erro ao remover grupo do serviço:', error);
        } finally {
            setSaving(false);
        }
    };

    // === MODO GRUPO: Associar materiais e serviços ao grupo ===
    const materiaisDoGrupo = materiais.filter((m) => m.gruposInsumoIds?.includes(selectedGrupo));
    const servicosDoGrupo = servicos.filter((s) => s.gruposInsumoIds?.includes(selectedGrupo));
    const materiaisDisponiveisGrupo = materiais.filter((m) => !m.gruposInsumoIds?.includes(selectedGrupo));
    const servicosDisponiveisGrupo = servicos.filter((s) => !s.gruposInsumoIds?.includes(selectedGrupo));

    const handleAddMaterialToGrupo = async () => {
        if (!selectedGrupo || !selectedMaterialToAdd) return;
        try {
            setSaving(true);
            await addGrupoToMaterial(selectedMaterialToAdd, selectedGrupo);
            await loadData();
            setSelectedMaterialToAdd('');
        } catch (error) {
            console.error('Erro ao adicionar material ao grupo:', error);
        } finally {
            setSaving(false);
        }
    };

    const handleRemoveMaterialFromGrupo = async (materialId: string) => {
        if (!selectedGrupo) return;
        try {
            setSaving(true);
            await removeGrupoFromMaterial(materialId, selectedGrupo);
            await loadData();
        } catch (error) {
            console.error('Erro ao remover material do grupo:', error);
        } finally {
            setSaving(false);
        }
    };

    const handleAddServicoToGrupo = async () => {
        if (!selectedGrupo || !selectedServicoToAdd) return;
        try {
            setSaving(true);
            await addGrupoToServico(selectedServicoToAdd, selectedGrupo);
            await loadData();
            setSelectedServicoToAdd('');
        } catch (error) {
            console.error('Erro ao adicionar serviço ao grupo:', error);
        } finally {
            setSaving(false);
        }
    };

    const handleRemoveServicoFromGrupo = async (servicoId: string) => {
        if (!selectedGrupo) return;
        try {
            setSaving(true);
            await removeGrupoFromServico(servicoId, selectedGrupo);
            await loadData();
        } catch (error) {
            console.error('Erro ao remover serviço do grupo:', error);
        } finally {
            setSaving(false);
        }
    };

    // === MODO FORNECEDOR: Associar grupos de insumos ao fornecedor ===
    const handleAddGrupoToFornecedor = async () => {
        if (!selectedFornecedor || !selectedGrupoToAdd) return;
        try {
            setSaving(true);
            const { error } = await supabase
                .from('fornecedor_grupo')
                .insert({
                    fornecedor_id: selectedFornecedor,
                    grupo_id: selectedGrupoToAdd,
                });

            if (error) {
                throw error;
            }

            await loadData();
            setSelectedGrupoToAdd('');
        } catch (error) {
            console.error('Erro ao adicionar grupo ao fornecedor:', error);
        } finally {
            setSaving(false);
        }
    };

    const handleRemoveGrupoFromFornecedor = async (grupoId: string) => {
        if (!selectedFornecedor) return;
        try {
            setSaving(true);
            const { error } = await supabase
                .from('fornecedor_grupo')
                .delete()
                .eq('fornecedor_id', selectedFornecedor)
                .eq('grupo_id', grupoId);

            if (error) {
                throw error;
            }

            await loadData();
        } catch (error) {
            console.error('Erro ao remover grupo do fornecedor:', error);
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center py-12">
                <div className="text-gray-600">Carregando...</div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-xl font-bold mb-1">Gestão de Relacionamentos</h2>
                <p className="text-sm text-gray-600">Gerencie os vínculos entre fases, serviços, grupos de insumo e materiais</p>
            </div>

            {/* Seletor de Modo */}
            <div className="flex gap-4 bg-gray-100 p-2 rounded-lg">
                <button
                    onClick={() => {
                        setViewMode('fase');
                        setSelectedServico('');
                        setSelectedGrupo('');
                    }}
                    className={`flex-1 px-4 py-2 rounded transition ${viewMode === 'fase'
                        ? 'bg-blue-600 text-white'
                        : 'bg-white text-gray-700 hover:bg-gray-200'
                        }`}
                >
                    Por Fase
                </button>
                <button
                    onClick={() => {
                        setViewMode('servico');
                        setSelectedFase('');
                        setSelectedGrupo('');
                    }}
                    className={`flex-1 px-4 py-2 rounded transition ${viewMode === 'servico'
                        ? 'bg-blue-600 text-white'
                        : 'bg-white text-gray-700 hover:bg-gray-200'
                        }`}
                >
                    Por Serviço
                </button>
                <button
                    onClick={() => {
                        setViewMode('grupo');
                        setSelectedFase('');
                        setSelectedServico('');
                    }}
                    className={`flex-1 px-4 py-2 rounded transition ${viewMode === 'grupo'
                        ? 'bg-blue-600 text-white'
                        : 'bg-white text-gray-700 hover:bg-gray-200'
                        }`}
                >
                    Por Grupo de Insumo
                </button>
                <button
                    onClick={() => {
                        setViewMode('fornecedor');
                        setSelectedFase('');
                        setSelectedServico('');
                        setSelectedGrupo('');
                    }}
                    className={`flex-1 px-4 py-2 rounded transition ${viewMode === 'fornecedor'
                        ? 'bg-blue-600 text-white'
                        : 'bg-white text-gray-700 hover:bg-gray-200'
                        }`}
                >
                    Por Fornecedor
                </button>
            </div>

            {/* MODO FASE */}
            {viewMode === 'fase' && (
                <div className="space-y-6">
                    <div className="bg-white rounded-lg shadow p-6">
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Selecione a Fase
                        </label>
                        <select
                            value={selectedFase}
                            onChange={(e) => setSelectedFase(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md"
                        >
                            <option value="">Escolha uma fase</option>
                            {fases.map((fase) => (
                                <option key={fase.id} value={fase.id}>
                                    {fase.nome}
                                </option>
                            ))}
                        </select>
                    </div>

                    {selectedFase && (
                        <div className="grid grid-cols-1 gap-6">
                            {/* Serviços Associados */}
                            <div className="bg-white rounded-lg shadow p-6">
                                <h3 className="text-lg font-semibold mb-4">Serviços Associados</h3>

                                {servicosNaFase.length > 0 ? (
                                    <div className="space-y-2 mb-4">
                                        {servicosNaFase.map((servico) => (
                                            <div
                                                key={servico.id}
                                                className="flex items-center justify-between p-3 bg-gray-50 rounded border"
                                            >
                                                <span className="text-sm">{servico.nome}</span>
                                                <button
                                                    onClick={() => handleRemoveServicoFromFase(servico.id)}
                                                    disabled={saving}
                                                    className="px-3 py-1 text-sm bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50"
                                                >
                                                    ✕
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="text-gray-500 text-sm mb-4">Nenhum serviço associado</p>
                                )}

                                <div className="flex gap-2">
                                    <select
                                        value={selectedServicoToAdd}
                                        onChange={(e) => setSelectedServicoToAdd(e.target.value)}
                                        className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm"
                                    >
                                        <option value="">Selecione um serviço</option>
                                        {servicosDisponiveis.map((servico) => (
                                            <option key={servico.id} value={servico.id}>
                                                {servico.nome}
                                            </option>
                                        ))}
                                    </select>
                                    <button
                                        onClick={handleAddServicoToFase}
                                        disabled={!selectedServicoToAdd || saving}
                                        className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 text-sm"
                                    >
                                        Adicionar
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* MODO SERVICO */}
            {viewMode === 'servico' && (
                <div className="space-y-6">
                    <div className="bg-white rounded-lg shadow p-6">
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Selecione o Serviço
                        </label>
                        <select
                            value={selectedServico}
                            onChange={(e) => setSelectedServico(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md"
                        >
                            <option value="">Escolha um serviço</option>
                            {servicos.map((servico) => (
                                <option key={servico.id} value={servico.id}>
                                    {servico.nome}
                                </option>
                            ))}
                        </select>
                    </div>

                    {selectedServico && (
                        <div className="grid grid-cols-2 gap-6">
                            {/* Fases Associadas */}
                            <div className="bg-white rounded-lg shadow p-6">
                                <h3 className="text-lg font-semibold mb-4">Fases Associadas</h3>

                                {fasesDoServico.length > 0 ? (
                                    <div className="space-y-2 mb-4">
                                        {fasesDoServico.map((fase) => (
                                            <div
                                                key={fase.id}
                                                className="flex items-center justify-between p-3 bg-gray-50 rounded border"
                                            >
                                                <span className="text-sm">{fase.nome}</span>
                                                <button
                                                    onClick={() => handleRemoveFaseFromServico(fase.id)}
                                                    disabled={saving}
                                                    className="px-3 py-1 text-sm bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50"
                                                >
                                                    ✕
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="text-gray-500 text-sm mb-4">Nenhuma fase associada</p>
                                )}

                                <div className="flex gap-2">
                                    <select
                                        value={selectedFaseToAdd}
                                        onChange={(e) => setSelectedFaseToAdd(e.target.value)}
                                        className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm"
                                    >
                                        <option value="">Selecione uma fase</option>
                                        {fasesDisponiveisServico.map((fase) => (
                                            <option key={fase.id} value={fase.id}>
                                                {fase.nome}
                                            </option>
                                        ))}
                                    </select>
                                    <button
                                        onClick={handleAddFaseToServico}
                                        disabled={!selectedFaseToAdd || saving}
                                        className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 text-sm"
                                    >
                                        Adicionar
                                    </button>
                                </div>
                            </div>

                            {/* Grupos Associados */}
                            <div className="bg-white rounded-lg shadow p-6">
                                <h3 className="text-lg font-semibold mb-4">Grupos de Insumo Associados</h3>

                                {gruposDoServico.length > 0 ? (
                                    <div className="space-y-2 mb-4">
                                        {gruposDoServico.map((grupo) => (
                                            <div
                                                key={grupo.id}
                                                className="flex items-center justify-between p-3 bg-gray-50 rounded border"
                                            >
                                                <span className="text-sm">{grupo.nome}</span>
                                                <button
                                                    onClick={() => handleRemoveGrupoFromServico(grupo.id)}
                                                    disabled={saving}
                                                    className="px-3 py-1 text-sm bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50"
                                                >
                                                    ✕
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="text-gray-500 text-sm mb-4">Nenhum grupo associado</p>
                                )}

                                <div className="flex gap-2">
                                    <select
                                        value={selectedGrupoToAdd}
                                        onChange={(e) => setSelectedGrupoToAdd(e.target.value)}
                                        className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm"
                                    >
                                        <option value="">Selecione um grupo</option>
                                        {gruposDisponiveisServico.map((grupo) => (
                                            <option key={grupo.id} value={grupo.id}>
                                                {grupo.nome}
                                            </option>
                                        ))}
                                    </select>
                                    <button
                                        onClick={handleAddGrupoToServico}
                                        disabled={!selectedGrupoToAdd || saving}
                                        className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 text-sm"
                                    >
                                        Adicionar
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* MODO GRUPO */}
            {viewMode === 'grupo' && (
                <div className="space-y-6">
                    <div className="bg-white rounded-lg shadow p-6">
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Selecione o Grupo de Insumo
                        </label>
                        <select
                            value={selectedGrupo}
                            onChange={(e) => setSelectedGrupo(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md"
                        >
                            <option value="">Escolha um grupo</option>
                            {grupos.map((grupo) => (
                                <option key={grupo.id} value={grupo.id}>
                                    {grupo.nome}
                                </option>
                            ))}
                        </select>
                    </div>

                    {selectedGrupo && (
                        <div className="grid grid-cols-2 gap-6">
                            {/* Materiais Associados */}
                            <div className="bg-white rounded-lg shadow p-6">
                                <h3 className="text-lg font-semibold mb-4">Materiais Associados</h3>

                                {materiaisDoGrupo.length > 0 ? (
                                    <div className="space-y-2 mb-4">
                                        {materiaisDoGrupo.map((material) => (
                                            <div
                                                key={material.id}
                                                className="flex items-center justify-between p-3 bg-gray-50 rounded border"
                                            >
                                                <span className="text-sm">{material.nome}</span>
                                                <button
                                                    onClick={() => handleRemoveMaterialFromGrupo(material.id)}
                                                    disabled={saving}
                                                    className="px-3 py-1 text-sm bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50"
                                                >
                                                    ✕
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="text-gray-500 text-sm mb-4">Nenhum material associado</p>
                                )}

                                <div className="flex gap-2">
                                    <select
                                        value={selectedMaterialToAdd}
                                        onChange={(e) => setSelectedMaterialToAdd(e.target.value)}
                                        className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm"
                                    >
                                        <option value="">Selecione um material</option>
                                        {materiaisDisponiveisGrupo.map((material) => (
                                            <option key={material.id} value={material.id}>
                                                {material.nome}
                                            </option>
                                        ))}
                                    </select>
                                    <button
                                        onClick={handleAddMaterialToGrupo}
                                        disabled={!selectedMaterialToAdd || saving}
                                        className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 text-sm"
                                    >
                                        Adicionar
                                    </button>
                                </div>
                            </div>

                            {/* Serviços Associados */}
                            <div className="bg-white rounded-lg shadow p-6">
                                <h3 className="text-lg font-semibold mb-4">Serviços Associados</h3>

                                {servicosDoGrupo.length > 0 ? (
                                    <div className="space-y-2 mb-4">
                                        {servicosDoGrupo.map((servico) => (
                                            <div
                                                key={servico.id}
                                                className="flex items-center justify-between p-3 bg-gray-50 rounded border"
                                            >
                                                <span className="text-sm">{servico.nome}</span>
                                                <button
                                                    onClick={() => handleRemoveServicoFromGrupo(servico.id)}
                                                    disabled={saving}
                                                    className="px-3 py-1 text-sm bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50"
                                                >
                                                    ✕
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="text-gray-500 text-sm mb-4">Nenhum serviço associado</p>
                                )}

                                <div className="flex gap-2">
                                    <select
                                        value={selectedServicoToAdd}
                                        onChange={(e) => setSelectedServicoToAdd(e.target.value)}
                                        className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm"
                                    >
                                        <option value="">Selecione um serviço</option>
                                        {servicosDisponiveisGrupo.map((servico) => (
                                            <option key={servico.id} value={servico.id}>
                                                {servico.nome}
                                            </option>
                                        ))}
                                    </select>
                                    <button
                                        onClick={handleAddServicoToGrupo}
                                        disabled={!selectedServicoToAdd || saving}
                                        className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 text-sm"
                                    >
                                        Adicionar
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* MODO FORNECEDOR */}
            {viewMode === 'fornecedor' && (
                <div className="bg-white p-6 rounded-lg shadow">
                    <h3 className="text-lg font-semibold mb-4 text-gray-900">
                        Gerenciar Vínculos: Fornecedor → Grupos de Insumos
                    </h3>

                    <div className="mb-6">
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Selecione o Fornecedor:
                        </label>
                        <select
                            value={selectedFornecedor}
                            onChange={(e) => setSelectedFornecedor(e.target.value)}
                            className="w-full px-4 py-2 border border-gray-300 rounded-md"
                        >
                            <option value="">Escolha um fornecedor</option>
                            {fornecedores.map((f) => (
                                <option key={f.id} value={f.id}>
                                    {f.razaoSocial}
                                </option>
                            ))}
                        </select>
                    </div>

                    {selectedFornecedor && currentFornecedor && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* Grupos Associados */}
                            <div className="border border-gray-200 rounded-lg p-4">
                                <h4 className="font-semibold text-gray-800 mb-3">
                                    Grupos de Insumos Associados
                                </h4>
                                {currentFornecedor.grupoInsumoIds && currentFornecedor.grupoInsumoIds.length > 0 ? (
                                    <div className="space-y-2 mb-4">
                                        {currentFornecedor.grupoInsumoIds.map((grupoId) => {
                                            const grupo = grupos.find((g) => g.id === grupoId);
                                            return grupo ? (
                                                <div
                                                    key={grupoId}
                                                    className="flex justify-between items-center bg-gray-50 p-2 rounded"
                                                >
                                                    <span className="text-sm">{grupo.nome}</span>
                                                    <button
                                                        onClick={() => handleRemoveGrupoFromFornecedor(grupoId)}
                                                        disabled={saving}
                                                        className="px-3 py-1 text-sm bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50"
                                                    >
                                                        ✕
                                                    </button>
                                                </div>
                                            ) : null;
                                        })}
                                    </div>
                                ) : (
                                    <p className="text-gray-500 text-sm mb-4">Nenhum grupo associado</p>
                                )}

                                <div className="flex flex-col sm:flex-row gap-2">
                                    <select
                                        value={selectedGrupoToAdd}
                                        onChange={(e) => setSelectedGrupoToAdd(e.target.value)}
                                        className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm w-full"
                                    >
                                        <option value="">Selecione um grupo</option>
                                        {grupos
                                            .filter((g) => !currentFornecedor.grupoInsumoIds?.includes(g.id))
                                            .map((grupo) => (
                                                <option key={grupo.id} value={grupo.id}>
                                                    {grupo.nome}
                                                </option>
                                            ))}
                                    </select>
                                    <button
                                        onClick={handleAddGrupoToFornecedor}
                                        disabled={!selectedGrupoToAdd || saving}
                                        className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 text-sm whitespace-nowrap"
                                    >
                                        Adicionar
                                    </button>
                                </div>
                            </div>

                            {/* Info do Fornecedor */}
                            <div className="border border-gray-200 rounded-lg p-4">
                                <h4 className="font-semibold text-gray-800 mb-3">
                                    Informações do Fornecedor
                                </h4>
                                <div className="space-y-2 text-sm">
                                    <div>
                                        <span className="font-medium text-gray-700">Razão Social:</span>
                                        <p className="text-gray-900">{currentFornecedor.razaoSocial}</p>
                                    </div>
                                    <div>
                                        <span className="font-medium text-gray-700">Total de grupos vinculados:</span>
                                        <p className="text-gray-900">{currentFornecedor.grupoInsumoIds?.length || 0}</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {saving && (
                <div className="fixed bottom-4 right-4 bg-blue-600 text-white px-4 py-2 rounded shadow-lg">
                    Salvando...
                </div>
            )}
        </div>
    );
}

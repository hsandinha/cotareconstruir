"use client";

import { useState, useEffect, useMemo } from "react";
import { TagIcon, ClockIcon, ShoppingCartIcon } from "@heroicons/react/24/outline";
import { supabase } from "@/lib/supabaseAuth";
import { useAuth } from "@/lib/useAuth";

interface Oferta {
    id: string;
    materialId: string;
    materialNome: string;
    materialUnidade: string;
    materialDescricao?: string;
    gruposInsumoIds: string[];
    fornecedorId: string;
    fornecedorNome: string;
    preco: number;
    precoFinal: number;
    tipoOferta: 'valor' | 'percentual';
    valorOferta: number;
    descontoPercentual: number;
    quantidadeMinima: number;
    estoque: number;
    ativo: boolean;
}

interface Servico {
    id: string;
    nome: string;
    faseIds: string[];
    gruposInsumoIds: string[];
}

interface Fase {
    id: string;
    nome: string;
    cronologia: number;
}

interface GrupoInsumo {
    id: string;
    nome: string;
}

interface Material {
    id: string;
    nome: string;
    gruposInsumoIds: string[];
}

export function ClientOpportunitiesSection() {
    const { user, initialized } = useAuth();
    const [selectedWorkId, setSelectedWorkId] = useState<string>("");
    const [works, setWorks] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    // Ofertas da coleção global
    const [ofertas, setOfertas] = useState<Oferta[]>([]);

    // Dados para filtrar por fase
    const [servicos, setServicos] = useState<Servico[]>([]);
    const [fases, setFases] = useState<Fase[]>([]);
    const [grupos, setGrupos] = useState<GrupoInsumo[]>([]);
    const [materiais, setMateriais] = useState<Material[]>([]);

    // Carregar ofertas ativas (tempo real)
    useEffect(() => {
        // Buscar ofertas inicialmente
        const fetchOfertas = async () => {
            const { data, error } = await supabase
                .from('ofertas')
                .select('*')
                .eq('ativo', true);

            if (error) {
                console.error("Erro ao carregar ofertas:", error);
                setOfertas([]);
            } else {
                console.log(`Ofertas ativas carregadas: ${data?.length || 0}`);
                setOfertas((data || []) as Oferta[]);
            }
            setLoading(false);
        };

        fetchOfertas();

        // Configurar subscription realtime para ofertas
        const channel = supabase
            .channel('ofertas_changes')
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'ofertas',
                    filter: 'ativo=eq.true'
                },
                async () => {
                    const { data } = await supabase
                        .from('ofertas')
                        .select('*')
                        .eq('ativo', true);

                    console.log(`Ofertas ativas carregadas: ${data?.length || 0}`);
                    setOfertas((data || []) as Oferta[]);
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, []);

    // Carregar dados auxiliares (fases, serviços, grupos, materiais) - tempo real para capturar mudanças
    useEffect(() => {
        // Buscar serviços e materiais inicialmente
        const fetchServicosAndMateriais = async () => {
            const [servicosRes, materiaisRes] = await Promise.all([
                supabase.from('servicos').select('*'),
                supabase.from('materiais').select('*')
            ]);

            if (servicosRes.data) {
                setServicos(servicosRes.data as Servico[]);
            }
            if (materiaisRes.data) {
                setMateriais(materiaisRes.data as Material[]);
            }
        };

        fetchServicosAndMateriais();

        // Listener para serviços (importante para capturar desassociações)
        const servicosChannel = supabase
            .channel('servicos_changes')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'servicos' },
                async () => {
                    const { data } = await supabase.from('servicos').select('*');
                    if (data) setServicos(data as Servico[]);
                }
            )
            .subscribe();

        // Listener para materiais (importante para capturar mudanças de grupos)
        const materiaisChannel = supabase
            .channel('materiais_changes')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'materiais' },
                async () => {
                    const { data } = await supabase.from('materiais').select('*');
                    if (data) setMateriais(data as Material[]);
                }
            )
            .subscribe();

        // Fases e grupos são mais estáticos, podem ser carregados uma vez
        const loadStaticData = async () => {
            try {
                const [fasesRes, gruposRes] = await Promise.all([
                    supabase.from('fases').select('*'),
                    supabase.from('grupos_insumo').select('*')
                ]);

                if (fasesRes.data) setFases(fasesRes.data as Fase[]);
                if (gruposRes.data) setGrupos(gruposRes.data as GrupoInsumo[]);
            } catch (error) {
                console.error("Erro ao carregar dados auxiliares:", error);
            }
        };

        loadStaticData();

        return () => {
            supabase.removeChannel(servicosChannel);
            supabase.removeChannel(materiaisChannel);
        };
    }, []);

    // Carregar obras do usuário
    useEffect(() => {
        if (!initialized) return;

        if (!user) {
            setWorks([]);
            return;
        }

        // Buscar obras inicialmente
        const fetchWorks = async () => {
            const { data, error } = await supabase
                .from('works')
                .select('*')
                .eq('user_id', user.id);

            if (error) {
                console.error("Erro ao carregar obras:", error);
                setWorks([]);
            } else {
                const worksData = (data || []).map(doc => ({
                    id: doc.id,
                    ...doc
                }));
                setWorks(worksData);
                if (worksData.length > 0 && !selectedWorkId) {
                    setSelectedWorkId(worksData[0].id);
                }
            }
        };

        fetchWorks();

        // Configurar subscription realtime para obras
        const worksChannel = supabase
            .channel('works_opportunities_changes')
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'works',
                    filter: `user_id=eq.${user.id}`
                },
                async () => {
                    const { data } = await supabase
                        .from('works')
                        .select('*')
                        .eq('user_id', user.id);

                    const worksData = (data || []).map(doc => ({
                        id: doc.id,
                        ...doc
                    }));
                    setWorks(worksData);
                    if (worksData.length > 0 && !selectedWorkId) {
                        setSelectedWorkId(worksData[0].id);
                    }
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(worksChannel);
        };
    }, [user, initialized]);

    const selectedWork = works.find(w => w.id === selectedWorkId);

    // Filtrar ofertas pela fase da obra
    const { filteredOfertas, gruposDaFase, showAllMode } = useMemo(() => {
        if (ofertas.length === 0) {
            return { filteredOfertas: [], gruposDaFase: [], showAllMode: false };
        }

        if (!selectedWork?.etapa) {
            return { filteredOfertas: ofertas, gruposDaFase: [], showAllMode: true };
        }

        // 1. Encontrar a fase pelo nome
        const faseAtual = fases.find(f =>
            f.nome.toLowerCase() === selectedWork.etapa.toLowerCase() ||
            f.nome.toLowerCase().includes(selectedWork.etapa.toLowerCase()) ||
            selectedWork.etapa.toLowerCase().includes(f.nome.toLowerCase())
        );

        if (!faseAtual) {
            return { filteredOfertas: ofertas, gruposDaFase: [], showAllMode: true };
        }

        // 2. Serviços da fase -> Grupos de Insumo (tempo real dos serviços)
        // DEBUG: Ver todos os serviços e suas faseIds
        console.log(`Fase atual: ${faseAtual.nome} (ID: ${faseAtual.id})`);
        console.log(`Todos os serviços:`, servicos.map(s => ({
            nome: s.nome,
            faseIds: s.faseIds,
            gruposInsumoIds: s.gruposInsumoIds
        })));

        const servicosDaFase = servicos.filter(s => s.faseIds?.includes(faseAtual.id));
        console.log(`Serviços filtrados para fase ${faseAtual.id}:`, servicosDaFase.map(s => s.nome));

        const gruposIdsDaFase = new Set<string>();
        servicosDaFase.forEach(s => {
            s.gruposInsumoIds?.forEach(gId => gruposIdsDaFase.add(gId));
        });

        console.log(`Grupos da fase:`, Array.from(gruposIdsDaFase));

        const gruposNomes = Array.from(gruposIdsDaFase).map(gId =>
            grupos.find(g => g.id === gId)?.nome || gId
        );

        if (gruposIdsDaFase.size === 0) {
            // Sem grupos associados à fase = sem ofertas específicas para esta fase
            console.log("Nenhum grupo associado à fase - mostrando nenhuma oferta específica");
            return { filteredOfertas: [], gruposDaFase: [], showAllMode: false };
        }

        // 3. Filtrar ofertas usando os dados em TEMPO REAL dos materiais
        // Busca o material atual e verifica se ele pertence a algum grupo da fase
        const ofertasFiltradas = ofertas.filter(oferta => {
            // Pegar os grupos de insumo do material em tempo real (não da oferta salva)
            const materialAtual = materiais.find(m => m.id === oferta.materialId);
            const gruposDoMaterial = materialAtual?.gruposInsumoIds || [];

            console.log(`Oferta: ${oferta.materialNome} (materialId: ${oferta.materialId})`);
            console.log(`  - Grupos do material (tempo real):`, gruposDoMaterial);
            console.log(`  - Grupos da fase:`, Array.from(gruposIdsDaFase));

            // Verificar se algum grupo do material está nos grupos da fase
            const match = gruposDoMaterial.some(gId => gruposIdsDaFase.has(gId));
            console.log(`  - Match:`, match);

            return match;
        });

        console.log(`Ofertas filtradas: ${ofertasFiltradas.length} de ${ofertas.length}`);

        // Retorna apenas as ofertas que correspondem à fase (pode ser vazio)
        return { filteredOfertas: ofertasFiltradas, gruposDaFase: gruposNomes, showAllMode: false };
    }, [ofertas, selectedWork, fases, servicos, grupos, materiais]);

    // Helper para pegar nomes dos grupos
    const getGruposNomes = (gruposIds: string[]) => {
        return gruposIds?.map(gId => grupos.find(g => g.id === gId)?.nome || gId) || [];
    };

    if (loading) {
        return <div className="p-8 text-center text-gray-500">Carregando oportunidades...</div>;
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-slate-900">Oportunidades Exclusivas</h2>
                    <p className="text-slate-600">Ofertas especiais dos fornecedores para sua obra.</p>
                </div>

                {works.length > 0 && (
                    <div className="w-full md:w-64">
                        <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">
                            Filtrar por Obra
                        </label>
                        <select
                            value={selectedWorkId}
                            onChange={(e) => setSelectedWorkId(e.target.value)}
                            className="w-full px-3 py-2 bg-white text-black border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                            {works.map((work) => (
                                <option key={work.id} value={work.id}>{work.obra}</option>
                            ))}
                        </select>
                    </div>
                )}
            </div>

            {/* Status da Obra */}
            {selectedWork && (
                <div className={`${showAllMode ? 'bg-amber-50 border-amber-100' : 'bg-blue-50 border-blue-100'} border rounded-xl p-4 flex items-center gap-4`}>
                    <div className={`p-3 ${showAllMode ? 'bg-amber-100 text-amber-600' : 'bg-blue-100 text-blue-600'} rounded-lg`}>
                        <ClockIcon className="h-6 w-6" />
                    </div>
                    <div>
                        <h3 className={`font-semibold ${showAllMode ? 'text-amber-900' : 'text-blue-900'}`}>
                            Cronograma Atual: {selectedWork.etapa}
                        </h3>
                        <p className={`text-sm ${showAllMode ? 'text-amber-700' : 'text-blue-700'}`}>
                            {showAllMode
                                ? `Mostrando todas as ${ofertas.length} ofertas disponíveis.`
                                : `${filteredOfertas.length} ofertas para: ${gruposDaFase.join(', ')}`
                            }
                        </p>
                    </div>
                </div>
            )}

            {/* Grid de Ofertas */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredOfertas.map((oferta) => {
                    const gruposNomes = getGruposNomes(oferta.gruposInsumoIds);

                    return (
                        <div key={oferta.id} className="bg-white rounded-2xl border border-slate-200 overflow-hidden hover:shadow-lg transition-shadow">
                            <div className="relative h-36 bg-gradient-to-br from-slate-100 to-slate-50">
                                {oferta.descontoPercentual > 0 && (
                                    <div className="absolute top-4 left-4 bg-red-500 text-white text-xs font-bold px-3 py-1 rounded-full shadow-sm">
                                        -{oferta.descontoPercentual}% OFF
                                    </div>
                                )}
                                <div className="absolute top-4 right-4 flex flex-wrap gap-1 justify-end max-w-[60%]">
                                    {gruposNomes.slice(0, 2).map((nome, idx) => (
                                        <span key={idx} className="bg-white/90 backdrop-blur text-slate-700 text-xs font-medium px-2 py-0.5 rounded-full shadow-sm border border-slate-100">
                                            {nome}
                                        </span>
                                    ))}
                                </div>
                                <div className="w-full h-full flex items-center justify-center text-slate-300">
                                    <TagIcon className="h-12 w-12" />
                                </div>
                            </div>

                            <div className="p-5">
                                <h3 className="text-lg font-bold text-slate-900 leading-tight">{oferta.materialNome}</h3>

                                <div className="flex items-end gap-2 my-4">
                                    <div>
                                        <p className="text-xs text-slate-400 line-through">R$ {oferta.preco.toFixed(2)}</p>
                                        <p className="text-2xl font-bold text-green-600">R$ {oferta.precoFinal.toFixed(2)}</p>
                                    </div>
                                    <span className="text-xs text-slate-500 mb-1.5">/{oferta.materialUnidade}</span>
                                </div>

                                <button className="w-full py-2.5 bg-slate-900 text-white rounded-xl font-semibold hover:bg-slate-800 flex items-center justify-center gap-2 transition-colors text-sm">
                                    <ShoppingCartIcon className="h-4 w-4" />
                                    Adicionar à Cotação
                                </button>
                            </div>
                        </div>
                    );
                })}
            </div>

            {filteredOfertas.length === 0 && (
                <div className="text-center py-12 bg-slate-50 rounded-2xl border border-dashed border-slate-300">
                    <TagIcon className="h-12 w-12 mx-auto text-slate-300 mb-3" />
                    <h3 className="text-lg font-medium text-slate-900">Nenhuma oferta encontrada</h3>
                    <p className="text-slate-500">
                        {ofertas.length === 0
                            ? "Nenhum fornecedor configurou ofertas ainda."
                            : "Não encontramos ofertas para a fase atual."
                        }
                    </p>
                </div>
            )}
        </div>
    );
}

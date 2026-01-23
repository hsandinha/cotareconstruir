"use client";

import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/lib/supabaseAuth";
import { useAuth } from "@/lib/useAuth";
import {
    Building2, Tag, Clock, ShoppingCart, Package,
    Loader2, AlertCircle, ChevronRight, Gift, TrendingDown, ArrowLeft
} from "lucide-react";

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

interface Obra {
    id: string;
    nome: string;
    descricao?: string;
    bairro?: string;
    cidade?: string;
    estado?: string;
    status: string;
    etapa?: string;
}

interface ObraEtapa {
    id: string;
    obra_id: string;
    fase_id: string;
    nome: string;
    categoria: string;
    data_prevista: string;
    dias_antecedencia_cotacao: number;
    is_completed: boolean;
    ordem: number;
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

    // Estados principais
    const [step, setStep] = useState<1 | 2>(1);
    const [selectedObraId, setSelectedObraId] = useState<string>("");
    const [obras, setObras] = useState<Obra[]>([]);
    const [obraEtapas, setObraEtapas] = useState<ObraEtapa[]>([]);
    const [loading, setLoading] = useState(true);

    // Ofertas
    const [ofertas, setOfertas] = useState<Oferta[]>([]);

    // Dados auxiliares
    const [servicos, setServicos] = useState<Servico[]>([]);
    const [fases, setFases] = useState<Fase[]>([]);
    const [grupos, setGrupos] = useState<GrupoInsumo[]>([]);
    const [materiais, setMateriais] = useState<Material[]>([]);

    // Carregar obras do usuário
    useEffect(() => {
        if (!initialized || !user) {
            setObras([]);
            setLoading(false);
            return;
        }

        const fetchObras = async () => {
            const { data, error } = await supabase
                .from('obras')
                .select('*')
                .eq('user_id', user.id);

            if (error) {
                console.error("Erro ao carregar obras:", error);
                setObras([]);
            } else {
                setObras((data || []) as Obra[]);
            }
            setLoading(false);
        };

        fetchObras();
    }, [user, initialized]);

    // Carregar etapas da obra selecionada
    useEffect(() => {
        if (!selectedObraId) {
            setObraEtapas([]);
            return;
        }

        const fetchEtapas = async () => {
            const { data, error } = await supabase
                .from('obra_etapas')
                .select('*')
                .eq('obra_id', selectedObraId)
                .order('ordem');

            if (!error && data) {
                setObraEtapas(data as ObraEtapa[]);
            }
        };

        fetchEtapas();
    }, [selectedObraId]);

    // Carregar ofertas ativas
    useEffect(() => {
        const fetchOfertas = async () => {
            const { data, error } = await supabase
                .from('ofertas')
                .select('*')
                .eq('ativo', true);

            if (!error && data) {
                setOfertas(data as Oferta[]);
            }
        };

        fetchOfertas();

        // Realtime
        const channel = supabase
            .channel('ofertas_opportunities')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'ofertas' }, fetchOfertas)
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, []);

    // Carregar dados auxiliares
    useEffect(() => {
        const loadData = async () => {
            const [servicosRes, fasesRes, gruposRes, materiaisRes] = await Promise.all([
                supabase.from('servicos').select('*'),
                supabase.from('fases').select('*'),
                supabase.from('grupos_insumo').select('*'),
                supabase.from('materiais').select('*')
            ]);

            if (servicosRes.data) setServicos(servicosRes.data as Servico[]);
            if (fasesRes.data) setFases(fasesRes.data as Fase[]);
            if (gruposRes.data) setGrupos(gruposRes.data as GrupoInsumo[]);
            if (materiaisRes.data) setMateriais(materiaisRes.data as Material[]);
        };

        loadData();
    }, []);

    // Encontrar obra selecionada
    const selectedObra = obras.find(o => o.id === selectedObraId);

    // Etapas válidas para cotação (dentro do período)
    const validEtapas = useMemo(() => {
        const hoje = new Date();
        hoje.setHours(0, 0, 0, 0);

        return obraEtapas.filter(etapa => {
            if (!etapa.data_prevista) return false;
            const dataPrevista = new Date(etapa.data_prevista);
            const dataInicioCotacao = new Date(dataPrevista);
            dataInicioCotacao.setDate(dataInicioCotacao.getDate() - etapa.dias_antecedencia_cotacao);
            return hoje >= dataInicioCotacao && !etapa.is_completed;
        });
    }, [obraEtapas]);

    // Filtrar ofertas baseado nas etapas válidas
    const filteredOfertas = useMemo(() => {
        if (ofertas.length === 0) return [];

        // Se não há etapas válidas, mostrar todas as ofertas
        if (validEtapas.length === 0) return ofertas;

        // Pegar os fase_ids das etapas válidas
        const faseIds = new Set(validEtapas.map(e => e.fase_id));

        // Serviços das fases
        const servicosDasFases = servicos.filter(s =>
            s.faseIds?.some(fId => faseIds.has(fId))
        );

        // Grupos de insumo desses serviços
        const gruposIdsDasFases = new Set<string>();
        servicosDasFases.forEach(s => {
            s.gruposInsumoIds?.forEach(gId => gruposIdsDasFases.add(gId));
        });

        if (gruposIdsDasFases.size === 0) return ofertas;

        // Filtrar ofertas pelos grupos
        return ofertas.filter(oferta => {
            const materialAtual = materiais.find(m => m.id === oferta.materialId);
            const gruposDoMaterial = materialAtual?.gruposInsumoIds || [];
            return gruposDoMaterial.some(gId => gruposIdsDasFases.has(gId));
        });
    }, [ofertas, validEtapas, servicos, materiais]);

    // Helper para pegar nomes dos grupos
    const getGruposNomes = (gruposIds: string[]) => {
        return gruposIds?.map(gId => grupos.find(g => g.id === gId)?.nome || gId).slice(0, 2) || [];
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center p-12">
                <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
                <span className="ml-3 text-slate-600">Carregando oportunidades...</span>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
                            <Gift className="w-6 h-6 text-emerald-600" />
                            Oportunidades Exclusivas
                        </h1>
                        <p className="text-slate-500 mt-1">Ofertas especiais dos fornecedores para sua obra</p>
                    </div>
                    {ofertas.length > 0 && (
                        <div className="flex items-center gap-2 rounded-full bg-emerald-100 px-4 py-2">
                            <Tag className="w-5 h-5 text-emerald-600" />
                            <span className="font-semibold text-emerald-600">{ofertas.length} {ofertas.length === 1 ? 'oferta' : 'ofertas'} ativas</span>
                        </div>
                    )}
                </div>

                {/* Progress Steps */}
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setStep(1)}
                        className={`flex items-center gap-2 flex-1 rounded-xl px-4 py-3 transition-all ${step === 1
                                ? 'bg-emerald-600 text-white shadow-lg'
                                : 'bg-emerald-100 text-emerald-700'
                            }`}
                    >
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${step === 1 ? 'bg-white/20 text-white' : 'bg-emerald-500 text-white'
                            }`}>
                            {step > 1 ? '✓' : '1'}
                        </div>
                        <span className="hidden sm:block text-sm font-medium">Selecionar Obra</span>
                    </button>
                    <ChevronRight className="w-5 h-5 text-slate-300 flex-shrink-0" />
                    <button
                        onClick={() => selectedObraId && setStep(2)}
                        disabled={!selectedObraId}
                        className={`flex items-center gap-2 flex-1 rounded-xl px-4 py-3 transition-all ${step === 2
                                ? 'bg-emerald-600 text-white shadow-lg'
                                : selectedObraId
                                    ? 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                                    : 'bg-slate-100 text-slate-400'
                            } disabled:cursor-not-allowed`}
                    >
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${step === 2 ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-500'
                            }`}>
                            2
                        </div>
                        <span className="hidden sm:block text-sm font-medium">Ver Ofertas</span>
                    </button>
                </div>
            </div>

            {/* Step 1: Selecionar Obra */}
            {step === 1 && (
                <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="w-12 h-12 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-600">
                            <Building2 className="w-6 h-6" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-slate-900">Para qual obra você quer ver ofertas?</h2>
                            <p className="text-sm text-slate-500">Selecione a obra para filtrar as oportunidades</p>
                        </div>
                    </div>

                    {obras.length === 0 ? (
                        <div className="rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 p-8 text-center">
                            <AlertCircle className="w-12 h-12 mx-auto text-slate-300 mb-4" />
                            <h3 className="text-lg font-semibold text-slate-700 mb-2">Nenhuma obra cadastrada</h3>
                            <p className="text-sm text-slate-500">Cadastre uma obra primeiro na aba "Obras & Endereços"</p>
                        </div>
                    ) : (
                        <div className="grid gap-3">
                            {obras.map(obra => (
                                <button
                                    key={obra.id}
                                    onClick={() => {
                                        setSelectedObraId(obra.id);
                                        setStep(2);
                                    }}
                                    className={`group relative flex items-center gap-4 rounded-xl border-2 p-4 text-left transition-all hover:border-emerald-300 hover:bg-emerald-50/50 ${selectedObraId === obra.id
                                            ? 'border-emerald-500 bg-emerald-50'
                                            : 'border-slate-200 bg-white'
                                        }`}
                                >
                                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center transition-colors ${selectedObraId === obra.id
                                            ? 'bg-emerald-500 text-white'
                                            : 'bg-slate-100 text-slate-500 group-hover:bg-emerald-100 group-hover:text-emerald-600'
                                        }`}>
                                        <Building2 className="w-6 h-6" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <h3 className="font-semibold text-slate-900 truncate">{obra.nome}</h3>
                                        {(obra.bairro || obra.cidade) && (
                                            <p className="text-sm text-slate-500 truncate">
                                                {[obra.bairro, obra.cidade].filter(Boolean).join(' • ')}
                                            </p>
                                        )}
                                        {obra.status && (
                                            <span className={`mt-1 inline-block text-xs font-medium px-2 py-0.5 rounded-full ${obra.status === 'ativa'
                                                    ? 'bg-emerald-100 text-emerald-700'
                                                    : 'bg-slate-100 text-slate-600'
                                                }`}>
                                                {obra.status}
                                            </span>
                                        )}
                                    </div>
                                    <ChevronRight className={`w-5 h-5 transition-all ${selectedObraId === obra.id ? 'text-emerald-500' : 'text-slate-300 group-hover:translate-x-1'
                                        }`} />
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* Step 2: Ver Ofertas */}
            {step === 2 && selectedObra && (
                <>
                    {/* Botão Voltar + Info da Obra */}
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => setStep(1)}
                            className="flex items-center gap-2 text-sm text-slate-600 hover:text-emerald-600 transition-colors"
                        >
                            <ArrowLeft className="w-4 h-4" />
                            Trocar obra
                        </button>
                        <div className="flex items-center gap-2 bg-emerald-50 rounded-lg px-3 py-1.5 border border-emerald-100">
                            <Building2 className="w-4 h-4 text-emerald-600" />
                            <span className="text-sm font-medium text-emerald-700">{selectedObra.nome}</span>
                        </div>
                    </div>

                    {/* Status das Etapas */}
                    {validEtapas.length > 0 && (
                        <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4 flex items-center gap-4">
                            <div className="p-3 bg-emerald-100 text-emerald-600 rounded-lg">
                                <Clock className="h-6 w-6" />
                            </div>
                            <div>
                                <h3 className="font-semibold text-emerald-900">
                                    {validEtapas.length} {validEtapas.length === 1 ? 'etapa em período de cotação' : 'etapas em período de cotação'}
                                </h3>
                                <p className="text-sm text-emerald-700">
                                    {validEtapas.map(e => e.nome).join(', ')}
                                </p>
                            </div>
                        </div>
                    )}

                    {/* Grid de Ofertas */}
                    {filteredOfertas.length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {filteredOfertas.map((oferta) => {
                                const gruposNomes = getGruposNomes(oferta.gruposInsumoIds);

                                return (
                                    <div key={oferta.id} className="bg-white rounded-2xl border border-slate-200 overflow-hidden hover:shadow-lg transition-all group">
                                        {/* Header do Card */}
                                        <div className="relative h-32 bg-gradient-to-br from-slate-50 to-slate-100 p-4">
                                            {oferta.descontoPercentual > 0 && (
                                                <div className="absolute top-3 left-3 bg-red-500 text-white text-xs font-bold px-3 py-1 rounded-full shadow-sm flex items-center gap-1">
                                                    <TrendingDown className="w-3 h-3" />
                                                    -{oferta.descontoPercentual}%
                                                </div>
                                            )}
                                            <div className="absolute top-3 right-3 flex flex-wrap gap-1 justify-end max-w-[60%]">
                                                {gruposNomes.map((nome, idx) => (
                                                    <span key={idx} className="bg-white/90 backdrop-blur text-slate-700 text-xs font-medium px-2 py-0.5 rounded-full shadow-sm border border-slate-100">
                                                        {nome}
                                                    </span>
                                                ))}
                                            </div>
                                            <div className="w-full h-full flex items-center justify-center">
                                                <Package className="h-12 w-12 text-slate-300 group-hover:text-emerald-400 transition-colors" />
                                            </div>
                                        </div>

                                        {/* Conteúdo */}
                                        <div className="p-5">
                                            <p className="text-xs text-slate-500 mb-1">{oferta.fornecedorNome}</p>
                                            <h3 className="text-lg font-bold text-slate-900 leading-tight mb-3">{oferta.materialNome}</h3>

                                            <div className="flex items-end gap-2 mb-4">
                                                <div>
                                                    {oferta.descontoPercentual > 0 && (
                                                        <p className="text-xs text-slate-400 line-through">R$ {oferta.preco.toFixed(2)}</p>
                                                    )}
                                                    <p className="text-2xl font-bold text-emerald-600">R$ {oferta.precoFinal.toFixed(2)}</p>
                                                </div>
                                                <span className="text-xs text-slate-500 mb-1.5">/{oferta.materialUnidade}</span>
                                            </div>

                                            {oferta.quantidadeMinima > 1 && (
                                                <p className="text-xs text-slate-500 mb-3">
                                                    Mín. {oferta.quantidadeMinima} {oferta.materialUnidade}
                                                </p>
                                            )}

                                            <button className="w-full py-2.5 bg-emerald-600 text-white rounded-xl font-semibold hover:bg-emerald-700 flex items-center justify-center gap-2 transition-colors text-sm">
                                                <ShoppingCart className="h-4 w-4" />
                                                Adicionar à Cotação
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        <div className="text-center py-12 bg-slate-50 rounded-2xl border border-dashed border-slate-300">
                            <Tag className="h-12 w-12 mx-auto text-slate-300 mb-3" />
                            <h3 className="text-lg font-medium text-slate-900">Nenhuma oferta disponível</h3>
                            <p className="text-slate-500">
                                {ofertas.length === 0
                                    ? "Nenhum fornecedor configurou ofertas ainda."
                                    : "Não há ofertas disponíveis para as etapas atuais desta obra."
                                }
                            </p>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}

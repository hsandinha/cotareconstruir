'use client';

import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import {
    LayoutDashboard,
    Layers,
    Wrench,
    Boxes,
    Package,
    Search,
    Plus,
    MoreVertical,
    Edit2,
    Trash2,
    X,
    Check,
    ChevronRight,
    ChevronDown,
    GripVertical,
    Filter,
    ArrowUpRight,
    AlertCircle,
    Save,
    ArrowLeft,
    RefreshCw,
    Database
} from 'lucide-react';
import RelationshipManager from './RelationshipManager';
import {
    Fase,
    Servico,
    GrupoInsumo,
    Material,
} from '@/lib/constructionData';
import {
    getFases,
    getServicos,
    getGruposInsumo,
    getMateriais,
    createFase,
    updateFase,
    deleteFase,
    createServico,
    updateServico,
    deleteServico,
    createGrupoInsumo,
    updateGrupoInsumo,
    deleteGrupoInsumo,
    createMaterial,
    updateMaterial,
    deleteMaterial,
    getServicosByGrupoInsumoId,
    getFasesByGrupoInsumoId
} from '@/lib/constructionServices';
import { supabase } from '@/lib/supabase';

// --- Types ---

type TabType = 'overview' | 'fases' | 'vinculos' | 'servicos' | 'grupos' | 'materiais';
type ViewMode = 'list' | 'grid';

interface StatCardProps {
    title: string;
    value: number;
    icon: React.ReactNode;
    trend?: string;
    color: 'blue' | 'indigo' | 'violet' | 'emerald';
}

// --- Components ---

const StatCard = ({ title, value, icon, trend, color }: StatCardProps) => {
    const colorStyles = {
        blue: 'bg-blue-50 text-blue-600',
        indigo: 'bg-indigo-50 text-indigo-600',
        violet: 'bg-violet-50 text-violet-600',
        emerald: 'bg-emerald-50 text-emerald-600',
    };

    return (
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-all duration-300">
            <div className="flex items-start justify-between">
                <div>
                    <p className="text-sm font-medium text-slate-500 mb-1">{title}</p>
                    <h3 className="text-3xl font-bold text-slate-900">{value}</h3>
                    {trend && <p className="text-xs text-slate-400 mt-2">{trend}</p>}
                </div>
                <div className={`p-3 rounded-xl ${colorStyles[color]}`}>
                    {icon}
                </div>
            </div>
        </div>
    );
};

const TabButton = ({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) => (
    <button
        onClick={onClick}
        className={`flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 ${active
            ? 'bg-blue-600 text-white shadow-lg shadow-blue-200'
            : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
            }`}
    >
        {icon}
        {label}
    </button>
);

const Badge = ({ children, color = 'slate', onClick }: { children: React.ReactNode; color?: 'slate' | 'blue' | 'green' | 'red'; onClick?: () => void }) => {
    const styles = {
        slate: 'bg-slate-100 text-slate-700 border-slate-200',
        blue: 'bg-blue-50 text-blue-700 border-blue-200',
        green: 'bg-green-50 text-green-700 border-green-200',
        red: 'bg-red-50 text-red-700 border-red-200',
    };

    return (
        <span
            onClick={onClick}
            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${styles[color]} ${onClick ? 'cursor-pointer hover:opacity-80' : ''}`}
        >
            {children}
        </span>
    );
};

// --- Helper Component for Tree View ---

const TreeItem = ({
    title,
    count,
    children,
    level = 0,
    defaultOpen = false,
    icon: Icon,
    actions
}: {
    title: React.ReactNode;
    count?: number;
    children?: React.ReactNode;
    level?: number;
    defaultOpen?: boolean;
    icon?: React.ElementType;
    actions?: React.ReactNode;
}) => {
    const [isOpen, setIsOpen] = useState(defaultOpen);
    const hasChildren = React.Children.count(children) > 0;

    return (
        <div className="w-full group">
            <div
                className={`
                    flex items-center justify-between p-3 
                    hover:bg-slate-50 transition-colors cursor-pointer border-b border-slate-50
                    ${level === 0 ? 'bg-white border-l-4 border-l-blue-500 shadow-sm mb-2 rounded-r-lg' : ''}
                    ${level === 1 ? 'bg-slate-50/50 border-l-2 border-l-indigo-300 ml-4 rounded-r-md' : ''}
                    ${level === 2 ? 'bg-slate-50/30 border-l-2 border-l-violet-200 ml-8 rounded-r-md' : ''}
                    ${level === 3 ? 'ml-12 border-l border-slate-200' : ''}
                `}
                onClick={(e) => {
                    e.stopPropagation();
                    setIsOpen(!isOpen);
                }}
                style={{ marginLeft: level > 0 ? `${level * 1.5}rem` : 0 }}
            >
                <div className="flex items-center gap-3 flex-1">
                    {hasChildren ? (
                        <div className={`p-1 rounded-md transition-transform duration-200 ${isOpen ? 'rotate-90 bg-slate-100' : ''}`}>
                            <ChevronRight className="w-4 h-4 text-slate-400" />
                        </div>
                    ) : (
                        <div className="w-6" /> // Spacer
                    )}

                    {Icon && <Icon className={`w-4 h-4 ${level === 0 ? 'text-blue-600' : level === 1 ? 'text-indigo-500' : 'text-slate-400'}`} />}

                    <div className="flex items-center gap-2">
                        <span className={`
                            ${level === 0 ? 'font-bold text-slate-800 text-lg' : ''}
                            ${level === 1 ? 'font-semibold text-slate-700' : ''}
                            ${level === 2 ? 'font-medium text-slate-600' : ''}
                            ${level === 3 ? 'text-sm text-slate-500' : ''}
                        `}>
                            {title}
                        </span>
                        {count !== undefined && (
                            <span className="text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">
                                {count}
                            </span>
                        )}
                    </div>
                </div>

                {actions && (
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
                        {actions}
                    </div>
                )}
            </div>

            {isOpen && hasChildren && (
                <div className="animate-in slide-in-from-top-2 duration-200">
                    {children}
                </div>
            )}
        </div>
    );
};

// --- Main Component ---

export default function ConstructionManagement() {
    // --- State ---
    const [activeTab, setActiveTab] = useState<TabType>('overview');
    const [searchQuery, setSearchQuery] = useState('');
    const [isSidebarOpen, setIsSidebarOpen] = useState(false); // For mobile or details panel

    // Data State - Agora usando Firestore
    const [fases, setFases] = useState<Fase[]>([]);
    const [servicos, setServicos] = useState<Servico[]>([]);
    const [grupos, setGrupos] = useState<GrupoInsumo[]>([]);
    const [materiais, setMateriais] = useState<Material[]>([]);
    const [manufacturers, setManufacturers] = useState<Array<{ id: string; name: string }>>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Editing State
    const [editingItem, setEditingItem] = useState<any | null>(null);
    const [editingType, setEditingType] = useState<TabType | null>(null); // 'fases', 'servicos', etc.
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [materialFilter, setMaterialFilter] = useState(''); // Filtro para materiais no modal

    // Drag State
    const [draggedItem, setDraggedItem] = useState<{ type: string; id: string } | null>(null);

    // --- Load data from Firestore ---
    const loadData = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);

            const [fasesData, servicosData, gruposData, materiaisData, manufacturersResult] = await Promise.all([
                getFases(),
                getServicos(),
                getGruposInsumo(),
                getMateriais(),
                supabase.from('manufacturers').select('id, name').order('name')
            ]);

            const manufacturersData = (manufacturersResult.data || []).map(doc => ({
                id: doc.id,
                name: doc.name || 'Sem nome'
            }));

            setFases(fasesData);
            setServicos(servicosData);
            setGrupos(gruposData);
            setMateriais(materiaisData);
            setManufacturers(manufacturersData);
        } catch (err) {
            console.error('Erro ao carregar dados:', err);
            setError('Erro ao carregar dados. Tente novamente.');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadData();
    }, [loadData]);

    // --- Derived Data & Indexes ---

    const faseById = useMemo(() => new Map(fases.map(f => [f.id, f])), [fases]);
    const servicoById = useMemo(() => new Map(servicos.map(s => [s.id, s])), [servicos]);
    const grupoById = useMemo(() => new Map(grupos.map(g => [g.id, g])), [grupos]);
    const materialById = useMemo(() => new Map(materiais.map(m => [m.id, m])), [materiais]);

    // Relationships (Reverse Lookups)
    const servicosByFaseId = useMemo(() => {
        const map = new Map<string, Servico[]>();
        servicos.forEach(s => {
            s.faseIds.forEach(faseId => {
                const list = map.get(faseId) || [];
                list.push(s);
                map.set(faseId, list);
            });
        });
        // Sort by order
        map.forEach(list => list.sort((a, b) => (a.ordem || 0) - (b.ordem || 0)));
        return map;
    }, [servicos]);

    const materiaisByGrupoId = useMemo(() => {
        const map = new Map<string, Material[]>();
        materiais.forEach(m => {
            m.gruposInsumoIds.forEach(gid => {
                const list = map.get(gid) || [];
                list.push(m);
                map.set(gid, list);
            });
        });
        return map;
    }, [materiais]);

    const servicosByGrupoId = useMemo(() => {
        const map = new Map<string, Servico[]>();
        servicos.forEach(s => {
            s.gruposInsumoIds.forEach(gid => {
                const list = map.get(gid) || [];
                list.push(s);
                map.set(gid, list);
            });
        });
        return map;
    }, [servicos]);

    // Fases que usam um determinado grupo (através dos serviços)
    const fasesByGrupoId = useMemo(() => {
        const map = new Map<string, Fase[]>();
        servicos.forEach(s => {
            s.faseIds.forEach(faseId => {
                const fase = faseById.get(faseId);
                if (!fase) return;
                s.gruposInsumoIds.forEach(gid => {
                    const list = map.get(gid) || [];
                    if (!list.find(f => f.id === fase.id)) {
                        list.push(fase);
                    }
                    map.set(gid, list);
                });
            });
        });
        // Sort by cronologia
        map.forEach(list => list.sort((a, b) => a.cronologia - b.cronologia));
        return map;
    }, [servicos, faseById]);

    // Serviços que usam um determinado material (através dos grupos)
    const servicosByMaterialId = useMemo(() => {
        const map = new Map<string, Servico[]>();
        materiais.forEach(m => {
            m.gruposInsumoIds.forEach(gid => {
                const servicosDoGrupo = servicosByGrupoId.get(gid) || [];
                servicosDoGrupo.forEach(s => {
                    const list = map.get(m.id) || [];
                    if (!list.find(serv => serv.id === s.id)) {
                        list.push(s);
                    }
                    map.set(m.id, list);
                });
            });
        });
        return map;
    }, [materiais, servicosByGrupoId]);

    // Fases que usam um determinado material (através dos serviços)
    const fasesByMaterialId = useMemo(() => {
        const map = new Map<string, Fase[]>();
        materiais.forEach(m => {
            const servicosDoMaterial = servicosByMaterialId.get(m.id) || [];
            servicosDoMaterial.forEach(s => {
                s.faseIds.forEach(faseId => {
                    const fase = faseById.get(faseId);
                    if (!fase) return;
                    const list = map.get(m.id) || [];
                    if (!list.find(f => f.id === fase.id)) {
                        list.push(fase);
                    }
                    map.set(m.id, list);
                });
            });
        });
        // Sort by cronologia
        map.forEach(list => list.sort((a, b) => a.cronologia - b.cronologia));
        return map;
    }, [materiais, servicosByMaterialId, faseById]);

    // --- Filtering Logic ---

    const filterItem = useCallback((text: string, query: string) => {
        return text.toLowerCase().includes(query.toLowerCase());
    }, []);

    const filteredFases = useMemo(() => {
        if (!searchQuery) return fases.sort((a, b) => a.cronologia - b.cronologia);
        return fases.filter(f => filterItem(f.nome, searchQuery) || filterItem(f.descricao || '', searchQuery));
    }, [fases, searchQuery, filterItem]);

    const filteredServicos = useMemo(() => {
        if (!searchQuery) return servicos;
        return servicos.filter(s => {
            const fases = s.faseIds.map(id => faseById.get(id)).filter(Boolean) as Fase[];
            return filterItem(s.nome, searchQuery) || fases.some(fase => filterItem(fase.nome, searchQuery));
        });
    }, [servicos, searchQuery, faseById, filterItem]);

    const filteredGrupos = useMemo(() => {
        if (!searchQuery) return grupos;
        return grupos.filter(g => filterItem(g.nome, searchQuery) || filterItem(g.descricao || '', searchQuery));
    }, [grupos, searchQuery, filterItem]);

    const filteredMateriais = useMemo(() => {
        if (!searchQuery) return materiais;
        return materiais.filter(m => {
            const gruposNomes = m.gruposInsumoIds.map(gid => grupoById.get(gid)?.nome || '').join(' ');
            return filterItem(m.nome, searchQuery) || filterItem(m.unidade, searchQuery) || filterItem(gruposNomes, searchQuery);
        });
    }, [materiais, searchQuery, grupoById, filterItem]);

    // --- Actions ---

    const handleSave = async (data: any) => {
        if (!editingType) return;

        try {
            if (editingType === 'fases') {
                if (data.id) {
                    await updateFase(data.id, data);
                    setFases(prev => prev.map(f => f.id === data.id ? { ...f, ...data } : f));
                } else {
                    const newId = await createFase({ ...data, cronologia: fases.length + 1 });
                    setFases(prev => [...prev, { ...data, id: newId, cronologia: prev.length + 1 }]);
                }
            } else if (editingType === 'servicos') {
                if (data.id) {
                    await updateServico(data.id, data);
                    setServicos(prev => prev.map(s => s.id === data.id ? { ...s, ...data } : s));
                } else {
                    const primeiraFase = data.faseIds?.[0];
                    const ordem = (primeiraFase ? servicosByFaseId.get(primeiraFase)?.length || 0 : 0) + 1;
                    const newId = await createServico({ ...data, ordem });
                    setServicos(prev => [...prev, { ...data, id: newId, ordem }]);
                }
            } else if (editingType === 'grupos') {
                if (data.id) {
                    await updateGrupoInsumo(data.id, data);
                    setGrupos(prev => prev.map(g => g.id === data.id ? { ...g, ...data } : g));
                } else {
                    const newId = await createGrupoInsumo(data);
                    setGrupos(prev => [...prev, { ...data, id: newId }]);
                }
            } else if (editingType === 'materiais') {
                if (data.id) {
                    await updateMaterial(data.id, data);
                    setMateriais(prev => prev.map(m => m.id === data.id ? { ...m, ...data } : m));
                } else {
                    const newId = await createMaterial(data);
                    setMateriais(prev => [...prev, { ...data, id: newId }]);
                }
            }

            setIsModalOpen(false);
            setEditingItem(null);
        } catch (error) {
            console.error('Erro ao salvar:', error);
            alert('Erro ao salvar. Tente novamente.');
        }
    };

    const handleDelete = async (type: TabType, id: string) => {
        if (!confirm('Tem certeza que deseja excluir?')) return;

        try {
            if (type === 'fases') {
                await deleteFase(id);
                setFases(prev => prev.filter(f => f.id !== id));
            } else if (type === 'servicos') {
                await deleteServico(id);
                setServicos(prev => prev.filter(s => s.id !== id));
            } else if (type === 'grupos') {
                await deleteGrupoInsumo(id);
                setGrupos(prev => prev.filter(g => g.id !== id));
                // Unlink from materials and services
                setMateriais(prev => prev.map(m => ({ ...m, gruposInsumoIds: m.gruposInsumoIds.filter(gid => gid !== id) })));
                setServicos(prev => prev.map(s => ({ ...s, gruposInsumoIds: s.gruposInsumoIds.filter(gid => gid !== id) })));
            } else if (type === 'materiais') {
                await deleteMaterial(id);
                setMateriais(prev => prev.filter(m => m.id !== id));
            }
        } catch (error) {
            console.error('Erro ao deletar:', error);
            alert('Erro ao deletar. Tente novamente.');
        }
    };

    const openModal = (type: TabType, item?: any) => {
        setEditingType(type);
        setEditingItem(item || {});
        setMaterialFilter(''); // Limpa o filtro de materiais ao abrir o modal
        setIsModalOpen(true);
    };

    // --- Drag and Drop Handlers ---

    const handleDragStart = (e: React.DragEvent, type: string, id: string) => {
        e.dataTransfer.setData('text/plain', JSON.stringify({ type, id }));
        setDraggedItem({ type, id });
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
    };

    const handleDrop = (e: React.DragEvent, targetId: string, targetType: string) => {
        e.preventDefault();
        const data = JSON.parse(e.dataTransfer.getData('text/plain'));

        if (data.type !== targetType) return;

        if (targetType === 'fase') {
            const draggedIndex = fases.findIndex(f => f.id === data.id);
            const targetIndex = fases.findIndex(f => f.id === targetId);
            if (draggedIndex === -1 || targetIndex === -1) return;

            const newFases = [...fases];
            const [removed] = newFases.splice(draggedIndex, 1);
            newFases.splice(targetIndex, 0, removed);

            // Reassign cronologia
            const updatedFases = newFases.map((f, idx) => ({ ...f, cronologia: idx + 1 }));
            setFases(updatedFases);
        }
        // Add logic for services reordering within a phase if needed
        setDraggedItem(null);
    };

    // --- Render Helpers ---

    const renderOverview = () => (
        <div className="space-y-8 animate-in fade-in duration-500">
            {/* Stats Row */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard
                    title="Fases da Obra"
                    value={fases.length}
                    icon={<Layers className="w-6 h-6" />}
                    color="blue"
                    trend="Estrutura cronológica"
                />
                <StatCard
                    title="Serviços"
                    value={servicos.length}
                    icon={<Wrench className="w-6 h-6" />}
                    color="indigo"
                    trend={`${servicos.filter(s => s.gruposInsumoIds.length > 0).length} vinculados`}
                />
                <StatCard
                    title="Grupos de Insumo"
                    value={grupos.length}
                    icon={<Boxes className="w-6 h-6" />}
                    color="violet"
                    trend="Categorias de materiais"
                />
                <StatCard
                    title="Materiais"
                    value={materiais.length}
                    icon={<Package className="w-6 h-6" />}
                    color="emerald"
                    trend="Itens cadastrados"
                />
            </div>

            {/* Hierarchical View - Tree Structure */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                    <div>
                        <h3 className="text-lg font-bold text-slate-900">Estrutura Hierárquica</h3>
                        <p className="text-sm text-slate-500">Navegue por Fases {'>'} Serviços {'>'} Grupos {'>'} Materiais</p>
                    </div>
                    <div className="flex gap-2">
                        <button onClick={() => setActiveTab('fases')} className="text-sm text-blue-600 hover:underline">Gerenciar Fases</button>
                    </div>
                </div>

                <div className="p-4 bg-slate-50/20 min-h-[400px]">
                    {filteredFases.map((fase) => {
                        const faseServicos = servicosByFaseId.get(fase.id) || [];

                        // Filter logic for deep search
                        if (searchQuery) {
                            const hasMatchingService = faseServicos.some(s => {
                                const sGrupos = s.gruposInsumoIds.map(id => grupoById.get(id)).filter(Boolean) as GrupoInsumo[];
                                const hasMatchingGroup = sGrupos.some(g => {
                                    const gMateriais = materiaisByGrupoId.get(g.id) || [];
                                    return filterItem(g.nome, searchQuery) || gMateriais.some(m => filterItem(m.nome, searchQuery));
                                });
                                return filterItem(s.nome, searchQuery) || hasMatchingGroup;
                            });
                            if (!filterItem(fase.nome, searchQuery) && !hasMatchingService) return null;
                        }

                        return (
                            <TreeItem
                                key={fase.id}
                                title={`${fase.cronologia}. ${fase.nome}`}
                                count={faseServicos.length}
                                level={0}
                                icon={Layers}
                                defaultOpen={!!searchQuery}
                            >
                                {faseServicos.map(servico => {
                                    const servicoGrupos = servico.gruposInsumoIds.map(id => grupoById.get(id)).filter(Boolean) as GrupoInsumo[];

                                    // Filter logic
                                    if (searchQuery) {
                                        const hasMatchingGroup = servicoGrupos.some(g => {
                                            const gMateriais = materiaisByGrupoId.get(g.id) || [];
                                            return filterItem(g.nome, searchQuery) || gMateriais.some(m => filterItem(m.nome, searchQuery));
                                        });
                                        if (!filterItem(servico.nome, searchQuery) && !hasMatchingGroup) return null;
                                    }

                                    return (
                                        <TreeItem
                                            key={servico.id}
                                            title={servico.nome}
                                            count={servicoGrupos.length}
                                            level={1}
                                            icon={Wrench}
                                            defaultOpen={!!searchQuery}
                                        >
                                            {servicoGrupos.length > 0 ? (
                                                servicoGrupos.map(grupo => {
                                                    const grupoMateriais = materiaisByGrupoId.get(grupo.id) || [];

                                                    // Filter logic
                                                    if (searchQuery) {
                                                        const hasMatchingMaterial = grupoMateriais.some(m => filterItem(m.nome, searchQuery));
                                                        if (!filterItem(grupo.nome, searchQuery) && !hasMatchingMaterial) return null;
                                                    }

                                                    return (
                                                        <TreeItem
                                                            key={grupo.id}
                                                            title={grupo.nome}
                                                            count={grupoMateriais.length}
                                                            level={2}
                                                            icon={Boxes}
                                                            defaultOpen={!!searchQuery}
                                                        >
                                                            {grupoMateriais.length > 0 ? (
                                                                <div className="pl-16 pr-4 py-2 grid grid-cols-1 gap-2">
                                                                    {grupoMateriais.map(material => {
                                                                        if (searchQuery && !filterItem(material.nome, searchQuery)) return null;
                                                                        return (
                                                                            <div key={material.id} className="flex items-center justify-between p-2 bg-white rounded border border-slate-100 hover:border-blue-200 transition-colors">
                                                                                <div className="flex items-center gap-2">
                                                                                    <Package className="w-3 h-3 text-emerald-500" />
                                                                                    <span className="text-sm text-slate-700">{material.nome}</span>
                                                                                </div>
                                                                                <span className="text-xs text-slate-400 bg-slate-50 px-1.5 py-0.5 rounded">
                                                                                    {material.unidade}
                                                                                </span>
                                                                            </div>
                                                                        );
                                                                    })}
                                                                </div>
                                                            ) : (
                                                                <div className="pl-16 py-2 text-xs text-slate-400 italic">Nenhum material vinculado a este grupo.</div>
                                                            )}
                                                        </TreeItem>
                                                    );
                                                })
                                            ) : (
                                                <div className="pl-12 py-2 text-xs text-slate-400 italic">Nenhum grupo de insumo vinculado.</div>
                                            )}
                                        </TreeItem>
                                    );
                                })}
                                {faseServicos.length === 0 && (
                                    <div className="pl-8 py-2 text-sm text-slate-400 italic">Nenhum serviço cadastrado nesta fase.</div>
                                )}
                            </TreeItem>
                        );
                    })}
                </div>
            </div>
        </div>
    );

    const renderList = (
        items: any[],
        type: TabType,
        renderItem: (item: any) => React.ReactNode
    ) => (
        <div className="space-y-4 animate-in slide-in-from-bottom-4 duration-500">
            <div className="flex justify-between items-center">
                <h2 className="text-xl font-bold text-slate-800 capitalize">Gerenciar {type}</h2>
                <button
                    onClick={() => openModal(type)}
                    className="btn-primary flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-xl hover:bg-blue-700 transition-colors shadow-sm"
                >
                    <Plus className="w-4 h-4" />
                    Adicionar Novo
                </button>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                {items.length === 0 ? (
                    <div className="p-12 text-center text-slate-500">
                        <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                            <Search className="w-8 h-8 text-slate-400" />
                        </div>
                        <p className="text-lg font-medium">Nenhum item encontrado</p>
                        <p className="text-sm">Tente ajustar sua busca ou adicione um novo item.</p>
                    </div>
                ) : (
                    <div className="divide-y divide-slate-100">
                        {items.map((item, idx) => (
                            <div
                                key={item.id}
                                draggable={type === 'fases'}
                                onDragStart={(e) => handleDragStart(e, 'fase', item.id)}
                                onDragOver={handleDragOver}
                                onDrop={(e) => handleDrop(e, item.id, 'fase')}
                                className={`p-4 hover:bg-slate-50 transition-colors group flex items-center gap-4 ${draggedItem?.id === item.id ? 'opacity-50 bg-blue-50' : ''}`}
                            >
                                {type === 'fases' && (
                                    <div className="cursor-grab text-slate-300 hover:text-slate-500">
                                        <GripVertical className="w-5 h-5" />
                                    </div>
                                )}
                                <div className="flex-1">
                                    {renderItem(item)}
                                </div>
                                <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button
                                        onClick={() => openModal(type, item)}
                                        className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                        title="Editar"
                                    >
                                        <Edit2 className="w-4 h-4" />
                                    </button>
                                    <button
                                        onClick={() => handleDelete(type, item.id)}
                                        className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                        title="Excluir"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );

    // --- Specific Renderers for Tabs ---

    const renderServicosTab = () => (
        <div className="space-y-4 animate-in slide-in-from-bottom-4 duration-500">
            <div className="flex justify-between items-center">
                <h2 className="text-xl font-bold text-slate-800">Gerenciar Serviços</h2>
                <button onClick={() => openModal('servicos')} className="btn-primary flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-xl hover:bg-blue-700 transition-colors shadow-sm">
                    <Plus className="w-4 h-4" /> Adicionar Novo
                </button>
            </div>
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden p-4">
                {filteredServicos.map(servico => {
                    const servicoGrupos = servico.gruposInsumoIds.map(id => grupoById.get(id)).filter(Boolean) as GrupoInsumo[];
                    const servicoFases = servico.faseIds.map(id => faseById.get(id)).filter(Boolean) as Fase[];
                    return (
                        <TreeItem
                            key={servico.id}
                            title={
                                <div className="flex items-center gap-3 flex-wrap">
                                    <span>{servico.nome}</span>
                                </div>
                            }
                            count={servicoGrupos.length}
                            level={0}
                            icon={Wrench}
                            actions={
                                <div className="flex items-center gap-1">
                                    <button
                                        onClick={(e) => { e.stopPropagation(); openModal('servicos', servico); }}
                                        className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                        title="Editar serviço"
                                    >
                                        <Edit2 className="w-4 h-4" />
                                    </button>
                                    <button
                                        onClick={(e) => { e.stopPropagation(); handleDelete('servicos', servico.id); }}
                                        className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                        title="Excluir serviço"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            }
                        >
                            <div className="pl-12 pr-4 py-2 space-y-4">
                                {/* Fases Associadas */}
                                <div className="p-3 bg-blue-50/50 rounded-lg border border-blue-100">
                                    <div className="flex items-center gap-2 mb-2">
                                        <Layers className="w-4 h-4 text-blue-600" />
                                        <span className="text-sm font-medium text-blue-800">Fases Associadas</span>
                                        <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full">{servicoFases.length}</span>
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                        {servicoFases.length > 0 ? (
                                            servicoFases.map(fase => (
                                                <span key={fase.id} className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded border border-blue-200">
                                                    {fase.cronologia}. {fase.nome}
                                                </span>
                                            ))
                                        ) : (
                                            <span className="text-xs text-slate-400 italic">Nenhuma fase associada</span>
                                        )}
                                    </div>
                                </div>

                                {/* Grupos de Insumo */}
                                {servicoGrupos.length > 0 ? (
                                    servicoGrupos.map(grupo => {
                                        const grupoMateriais = materiaisByGrupoId.get(grupo.id) || [];
                                        return (
                                            <TreeItem
                                                key={grupo.id}
                                                title={grupo.nome}
                                                count={grupoMateriais.length}
                                                level={1}
                                                icon={Boxes}
                                            >
                                                <div className="pl-12 pr-4 py-2 grid grid-cols-1 gap-2">
                                                    {grupoMateriais.map(material => (
                                                        <div key={material.id} className="flex items-center justify-between p-2 bg-white rounded border border-slate-100">
                                                            <div className="flex items-center gap-2">
                                                                <Package className="w-3 h-3 text-emerald-500" />
                                                                <span className="text-sm text-slate-700">{material.nome}</span>
                                                            </div>
                                                            <span className="text-xs text-slate-400 bg-slate-50 px-1.5 py-0.5 rounded">{material.unidade}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </TreeItem>
                                        );
                                    })
                                ) : (
                                    <div className="text-xs text-slate-400 italic">Nenhum grupo vinculado.</div>
                                )}
                            </div>
                        </TreeItem>
                    );
                })}
            </div>
        </div>
    );

    const renderGruposTab = () => (
        <div className="space-y-4 animate-in slide-in-from-bottom-4 duration-500">
            <div className="flex justify-between items-center">
                <h2 className="text-xl font-bold text-slate-800">Gerenciar Grupos</h2>
                <button onClick={() => openModal('grupos')} className="btn-primary flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-xl hover:bg-blue-700 transition-colors shadow-sm">
                    <Plus className="w-4 h-4" /> Adicionar Novo
                </button>
            </div>
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden p-4">
                {filteredGrupos.map(grupo => {
                    const grupoMateriais = materiaisByGrupoId.get(grupo.id) || [];
                    const grupoServicos = servicosByGrupoId.get(grupo.id) || [];
                    const grupoFases = fasesByGrupoId.get(grupo.id) || [];
                    return (
                        <TreeItem
                            key={grupo.id}
                            title={grupo.nome}
                            count={grupoMateriais.length}
                            level={0}
                            icon={Boxes}
                            actions={
                                <div className="flex items-center gap-1">
                                    <button
                                        onClick={(e) => { e.stopPropagation(); openModal('grupos', grupo); }}
                                        className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                        title="Editar grupo"
                                    >
                                        <Edit2 className="w-4 h-4" />
                                    </button>
                                    <button
                                        onClick={(e) => { e.stopPropagation(); handleDelete('grupos', grupo.id); }}
                                        className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                        title="Excluir grupo"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            }
                        >
                            <div className="pl-12 pr-4 py-2 space-y-4">
                                {/* Fases Associadas */}
                                <div className="p-3 bg-blue-50/50 rounded-lg border border-blue-100">
                                    <div className="flex items-center gap-2 mb-2">
                                        <Layers className="w-4 h-4 text-blue-600" />
                                        <span className="text-sm font-medium text-blue-800">Fases Associadas</span>
                                        <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full">{grupoFases.length}</span>
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                        {grupoFases.length > 0 ? (
                                            grupoFases.map(fase => (
                                                <span key={fase.id} className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded border border-blue-200">
                                                    {fase.cronologia}. {fase.nome}
                                                </span>
                                            ))
                                        ) : (
                                            <span className="text-xs text-slate-400 italic">Nenhuma fase associada</span>
                                        )}
                                    </div>
                                </div>

                                {/* Serviços Associados */}
                                <div className="p-3 bg-indigo-50/50 rounded-lg border border-indigo-100">
                                    <div className="flex items-center gap-2 mb-2">
                                        <Wrench className="w-4 h-4 text-indigo-600" />
                                        <span className="text-sm font-medium text-indigo-800">Serviços Associados</span>
                                        <span className="text-xs bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded-full">{grupoServicos.length}</span>
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                        {grupoServicos.length > 0 ? (
                                            grupoServicos.map(servico => (
                                                <span key={servico.id} className="text-xs bg-indigo-100 text-indigo-700 px-2 py-1 rounded border border-indigo-200">
                                                    {servico.nome}
                                                </span>
                                            ))
                                        ) : (
                                            <span className="text-xs text-slate-400 italic">Nenhum serviço associado</span>
                                        )}
                                    </div>
                                </div>

                                {/* Materiais do Grupo */}
                                <div className="p-3 bg-emerald-50/50 rounded-lg border border-emerald-100">
                                    <div className="flex items-center gap-2 mb-2">
                                        <Package className="w-4 h-4 text-emerald-600" />
                                        <span className="text-sm font-medium text-emerald-800">Materiais do Grupo</span>
                                        <span className="text-xs bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-full">{grupoMateriais.length}</span>
                                    </div>
                                    <div className="grid grid-cols-1 gap-2">
                                        {grupoMateriais.length > 0 ? (
                                            grupoMateriais.map(material => (
                                                <div key={material.id} className="flex items-center justify-between p-2 bg-white rounded border border-emerald-100">
                                                    <div className="flex items-center gap-2">
                                                        <Package className="w-3 h-3 text-emerald-500" />
                                                        <span className="text-sm text-slate-700">{material.nome}</span>
                                                    </div>
                                                    <span className="text-xs text-slate-400 bg-slate-50 px-1.5 py-0.5 rounded">{material.unidade}</span>
                                                </div>
                                            ))
                                        ) : (
                                            <span className="text-xs text-slate-400 italic">Nenhum material neste grupo</span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </TreeItem>
                    );
                })}
            </div>
        </div>
    );

    const renderMateriaisTab = () => (
        <div className="space-y-4 animate-in slide-in-from-bottom-4 duration-500">
            <div className="flex justify-between items-center">
                <h2 className="text-xl font-bold text-slate-800">Gerenciar Materiais</h2>
                <button onClick={() => openModal('materiais')} className="btn-primary flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-xl hover:bg-blue-700 transition-colors shadow-sm">
                    <Plus className="w-4 h-4" /> Adicionar Novo
                </button>
            </div>
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden p-4">
                {filteredMateriais.map(material => {
                    const gruposVinculados = material.gruposInsumoIds.map(id => grupoById.get(id)).filter(Boolean) as GrupoInsumo[];
                    const servicosVinculados = servicosByMaterialId.get(material.id) || [];
                    const fasesVinculadas = fasesByMaterialId.get(material.id) || [];
                    return (
                        <TreeItem
                            key={material.id}
                            title={material.nome}
                            level={0}
                            icon={Package}
                            actions={
                                <div className="flex items-center gap-1">
                                    <button
                                        onClick={(e) => { e.stopPropagation(); openModal('materiais', material); }}
                                        className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                        title="Editar material"
                                    >
                                        <Edit2 className="w-4 h-4" />
                                    </button>
                                    <button
                                        onClick={(e) => { e.stopPropagation(); handleDelete('materiais', material.id); }}
                                        className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                        title="Excluir material"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            }
                        >
                            <div className="pl-12 pr-4 py-2 space-y-4">
                                {/* Unidade */}
                                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                                    <span className="text-sm font-medium text-slate-700">Unidade:</span>
                                    <span className="ml-2 text-sm text-slate-600 bg-white px-2 py-0.5 rounded border border-slate-200">{material.unidade}</span>
                                </div>

                                {/* Fases Associadas */}
                                <div className="p-3 bg-blue-50/50 rounded-lg border border-blue-100">
                                    <div className="flex items-center gap-2 mb-2">
                                        <Layers className="w-4 h-4 text-blue-600" />
                                        <span className="text-sm font-medium text-blue-800">Fases Associadas</span>
                                        <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full">{fasesVinculadas.length}</span>
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                        {fasesVinculadas.length > 0 ? (
                                            fasesVinculadas.map(fase => (
                                                <span key={fase.id} className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded border border-blue-200">
                                                    {fase.cronologia}. {fase.nome}
                                                </span>
                                            ))
                                        ) : (
                                            <span className="text-xs text-slate-400 italic">Nenhuma fase associada</span>
                                        )}
                                    </div>
                                </div>

                                {/* Serviços Associados */}
                                <div className="p-3 bg-indigo-50/50 rounded-lg border border-indigo-100">
                                    <div className="flex items-center gap-2 mb-2">
                                        <Wrench className="w-4 h-4 text-indigo-600" />
                                        <span className="text-sm font-medium text-indigo-800">Serviços Associados</span>
                                        <span className="text-xs bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded-full">{servicosVinculados.length}</span>
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                        {servicosVinculados.length > 0 ? (
                                            servicosVinculados.map(servico => (
                                                <span key={servico.id} className="text-xs bg-indigo-100 text-indigo-700 px-2 py-1 rounded border border-indigo-200">
                                                    {servico.nome}
                                                </span>
                                            ))
                                        ) : (
                                            <span className="text-xs text-slate-400 italic">Nenhum serviço associado</span>
                                        )}
                                    </div>
                                </div>

                                {/* Grupos Vinculados */}
                                <div className="p-3 bg-violet-50/50 rounded-lg border border-violet-100">
                                    <div className="flex items-center gap-2 mb-2">
                                        <Boxes className="w-4 h-4 text-violet-600" />
                                        <span className="text-sm font-medium text-violet-800">Grupos Vinculados</span>
                                        <span className="text-xs bg-violet-100 text-violet-700 px-1.5 py-0.5 rounded-full">{gruposVinculados.length}</span>
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                        {gruposVinculados.length > 0 ? (
                                            gruposVinculados.map(g => (
                                                <span key={g.id} className="text-xs bg-violet-100 text-violet-700 px-2 py-1 rounded border border-violet-200">
                                                    {g.nome}
                                                </span>
                                            ))
                                        ) : (
                                            <span className="text-xs text-slate-400 italic">Nenhum grupo vinculado</span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </TreeItem>
                    );
                })}
            </div>
        </div>
    );

    // --- Modal Component ---

    const Modal = () => {
        if (!isModalOpen || !editingType) return null;

        const [formData, setFormData] = useState<any>(editingItem || {});

        // Multi-select helpers
        const toggleSelection = (field: string, value: string) => {
            const current = formData[field] || [];
            const updated = current.includes(value)
                ? current.filter((id: string) => id !== value)
                : [...current, value];
            setFormData({ ...formData, [field]: updated });
        };

        return (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto flex flex-col">
                    <div className="p-6 border-b border-slate-100 flex justify-between items-center sticky top-0 bg-white z-10">
                        <h3 className="text-xl font-bold text-slate-900">
                            {editingItem?.id ? 'Editar' : 'Criar'} {editingType === 'materiais' ? 'Material' : editingType.slice(0, -1)}
                        </h3>
                        <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                            <X className="w-5 h-5 text-slate-500" />
                        </button>
                    </div>

                    <div className="p-6 space-y-6 flex-1">
                        {/* Common Fields */}
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Nome</label>
                                <input
                                    type="text"
                                    value={formData.nome || ''}
                                    onChange={e => setFormData({ ...formData, nome: e.target.value })}
                                    className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                                    placeholder="Ex: Pintura, Cimento..."
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Descrição (Opcional)</label>
                                <textarea
                                    value={formData.descricao || ''}
                                    onChange={e => setFormData({ ...formData, descricao: e.target.value })}
                                    className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all min-h-[80px]"
                                    placeholder="Detalhes adicionais..."
                                />
                            </div>
                        </div>

                        {/* Specific Fields */}
                        {editingType === 'fases' && (
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-2">Serviços Associados</label>
                                    <div className="border border-slate-200 rounded-xl p-4 max-h-60 overflow-y-auto bg-slate-50">
                                        <div className="grid grid-cols-1 gap-2">
                                            {servicos.map(s => (
                                                <label key={s.id} className="flex items-center gap-2 p-2 hover:bg-white rounded-lg cursor-pointer transition-colors">
                                                    <input
                                                        type="checkbox"
                                                        checked={(s.faseIds || []).includes(formData.id || '')}
                                                        onChange={async () => {
                                                            // Toggle service's association with this fase
                                                            const currentFases = s.faseIds || [];
                                                            const faseId = formData.id || '';
                                                            let newFases: string[];
                                                            if (currentFases.includes(faseId)) {
                                                                // Remove association
                                                                newFases = currentFases.filter(id => id !== faseId);
                                                            } else {
                                                                // Add association
                                                                newFases = [...currentFases, faseId];
                                                            }
                                                            // Update local state immediately for UI feedback
                                                            setServicos(prev => prev.map(srv =>
                                                                srv.id === s.id ? { ...srv, faseIds: newFases } : srv
                                                            ));
                                                            // Update in database
                                                            await updateServico(s.id, { faseIds: newFases });
                                                        }}
                                                        className="rounded text-blue-600 focus:ring-blue-500"
                                                        disabled={!formData.id}
                                                    />
                                                    <span className="text-sm text-slate-700">{s.nome}</span>
                                                </label>
                                            ))}
                                        </div>
                                    </div>
                                    {!formData.id && (
                                        <p className="text-xs text-amber-600 mt-2">💡 Salve a fase primeiro para poder associar serviços</p>
                                    )}
                                </div>
                            </div>
                        )}

                        {editingType === 'servicos' && (
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-2">Fases Associadas</label>
                                    <div className="border border-slate-200 rounded-xl p-4 max-h-60 overflow-y-auto bg-slate-50">
                                        <div className="grid grid-cols-1 gap-2">
                                            {fases.sort((a, b) => a.cronologia - b.cronologia).map(f => (
                                                <label key={f.id} className="flex items-center gap-2 p-2 hover:bg-white rounded-lg cursor-pointer transition-colors">
                                                    <input
                                                        type="checkbox"
                                                        checked={(formData.faseIds || []).includes(f.id)}
                                                        onChange={() => toggleSelection('faseIds', f.id)}
                                                        className="rounded text-blue-600 focus:ring-blue-500"
                                                    />
                                                    <span className="text-sm text-slate-700">{f.cronologia}. {f.nome}</span>
                                                </label>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-2">Grupos de Insumo Vinculados</label>
                                    <div className="border border-slate-200 rounded-xl p-4 max-h-60 overflow-y-auto bg-slate-50">
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                            {grupos.map(g => (
                                                <label key={g.id} className="flex items-center gap-2 p-2 hover:bg-white rounded-lg cursor-pointer transition-colors">
                                                    <input
                                                        type="checkbox"
                                                        checked={(formData.gruposInsumoIds || []).includes(g.id)}
                                                        onChange={() => toggleSelection('gruposInsumoIds', g.id)}
                                                        className="rounded text-blue-600 focus:ring-blue-500"
                                                    />
                                                    <span className="text-sm text-slate-700">{g.nome}</span>
                                                </label>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {editingType === 'materiais' && (
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Unidade</label>
                                    <input
                                        type="text"
                                        value={formData.unidade || ''}
                                        onChange={e => setFormData({ ...formData, unidade: e.target.value })}
                                        className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none"
                                        placeholder="Ex: kg, m², un..."
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Fabricante (Opcional)</label>
                                    <select
                                        value={formData.fabricante || ''}
                                        onChange={e => setFormData({ ...formData, fabricante: e.target.value })}
                                        className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none"
                                    >
                                        <option value="">Selecione um fabricante...</option>
                                        {manufacturers.length === 0 ? (
                                            <option value="" disabled>Carregando fabricantes...</option>
                                        ) : (
                                            manufacturers.map((m) => (
                                                <option key={m.id} value={m.name}>{m.name}</option>
                                            ))
                                        )}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-2">Grupos de Insumo (Categorias)</label>
                                    <div className="border border-slate-200 rounded-xl p-4 max-h-60 overflow-y-auto bg-slate-50">
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                            {grupos.map(g => (
                                                <label key={g.id} className="flex items-center gap-2 p-2 hover:bg-white rounded-lg cursor-pointer transition-colors">
                                                    <input
                                                        type="checkbox"
                                                        checked={(formData.gruposInsumoIds || []).includes(g.id)}
                                                        onChange={() => toggleSelection('gruposInsumoIds', g.id)}
                                                        className="rounded text-blue-600 focus:ring-blue-500"
                                                    />
                                                    <span className="text-sm text-slate-700">{g.nome}</span>
                                                </label>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {editingType === 'grupos' && (
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-2">Materiais Associados</label>
                                    <input
                                        type="text"
                                        placeholder="Filtrar materiais..."
                                        value={materialFilter}
                                        onChange={(e) => setMaterialFilter(e.target.value)}
                                        className="w-full px-4 py-2 mb-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                                    />
                                    <div className="border border-slate-200 rounded-xl p-4 max-h-60 overflow-y-auto bg-slate-50">
                                        <div className="grid grid-cols-1 gap-2">
                                            {materiais
                                                .filter(m => m.nome.toLowerCase().includes(materialFilter.toLowerCase()))
                                                .map(m => (
                                                    <label key={m.id} className="flex items-center gap-2 p-2 hover:bg-white rounded-lg cursor-pointer transition-colors">
                                                        <input
                                                            type="checkbox"
                                                            checked={(m.gruposInsumoIds || []).includes(formData.id || '')}
                                                            onChange={async () => {
                                                                // Toggle material's association with this group
                                                                const currentGroups = m.gruposInsumoIds || [];
                                                                const groupId = formData.id || '';
                                                                let newGroups: string[];
                                                                if (currentGroups.includes(groupId)) {
                                                                    // Remove association
                                                                    newGroups = currentGroups.filter(id => id !== groupId);
                                                                } else {
                                                                    // Add association
                                                                    newGroups = [...currentGroups, groupId];
                                                                }
                                                                // Update local state immediately for UI feedback
                                                                setMateriais(prev => prev.map(mat =>
                                                                    mat.id === m.id ? { ...mat, gruposInsumoIds: newGroups } : mat
                                                                ));
                                                                // Update in database
                                                                await updateMaterial(m.id, { gruposInsumoIds: newGroups });
                                                            }}
                                                            className="rounded text-blue-600 focus:ring-blue-500"
                                                            disabled={!formData.id}
                                                        />
                                                        <span className="text-sm text-slate-700">{m.nome}</span>
                                                        <span className="text-xs text-slate-400 ml-auto">{m.unidade}</span>
                                                    </label>
                                                ))}
                                        </div>
                                    </div>
                                    {!formData.id && (
                                        <p className="text-xs text-amber-600 mt-2">💡 Salve o grupo primeiro para poder associar materiais</p>
                                    )}
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-2">Serviços Associados</label>
                                    <div className="border border-slate-200 rounded-xl p-4 max-h-60 overflow-y-auto bg-slate-50">
                                        <div className="grid grid-cols-1 gap-2">
                                            {servicos.map(s => (
                                                <label key={s.id} className="flex items-center gap-2 p-2 hover:bg-white rounded-lg cursor-pointer transition-colors">
                                                    <input
                                                        type="checkbox"
                                                        checked={(s.gruposInsumoIds || []).includes(formData.id || '')}
                                                        onChange={async () => {
                                                            // Toggle service's association with this group
                                                            const currentGroups = s.gruposInsumoIds || [];
                                                            const groupId = formData.id || '';
                                                            let newGroups: string[];
                                                            if (currentGroups.includes(groupId)) {
                                                                // Remove association
                                                                newGroups = currentGroups.filter(id => id !== groupId);
                                                            } else {
                                                                // Add association
                                                                newGroups = [...currentGroups, groupId];
                                                            }
                                                            // Update local state immediately for UI feedback
                                                            setServicos(prev => prev.map(srv =>
                                                                srv.id === s.id ? { ...srv, gruposInsumoIds: newGroups } : srv
                                                            ));
                                                            // Update in database
                                                            await updateServico(s.id, { gruposInsumoIds: newGroups });
                                                        }}
                                                        className="rounded text-blue-600 focus:ring-blue-500"
                                                        disabled={!formData.id}
                                                    />
                                                    <span className="text-sm text-slate-700">{s.nome}</span>
                                                </label>
                                            ))}
                                        </div>
                                    </div>
                                    {!formData.id && (
                                        <p className="text-xs text-amber-600 mt-2">💡 Salve o grupo primeiro para poder associar serviços</p>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="p-6 border-t border-slate-100 bg-slate-50 rounded-b-2xl flex justify-end gap-3">
                        <button
                            onClick={() => setIsModalOpen(false)}
                            className="px-4 py-2 text-slate-600 hover:bg-slate-200 rounded-xl transition-colors font-medium"
                        >
                            Cancelar
                        </button>
                        <button
                            onClick={() => handleSave(formData)}
                            className="px-6 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors font-medium shadow-lg shadow-blue-200 flex items-center gap-2"
                        >
                            <Save className="w-4 h-4" />
                            Salvar Alterações
                        </button>
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="min-h-screen bg-slate-50/50 p-4 md:p-8 font-sans text-slate-900">
            {loading && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm">
                    <div className="bg-white p-6 rounded-2xl shadow-2xl flex flex-col items-center gap-4">
                        <RefreshCw className="w-8 h-8 text-blue-600 animate-spin" />
                        <p className="text-slate-700 font-medium">Carregando dados...</p>
                    </div>
                </div>
            )}

            {error && (
                <div className="fixed top-4 right-4 z-50 bg-red-50 border border-red-200 text-red-800 p-4 rounded-xl shadow-lg flex items-center gap-3">
                    <AlertCircle className="w-5 h-5" />
                    <div>
                        <p className="font-medium">{error}</p>
                        <button onClick={loadData} className="text-sm underline mt-1">Tentar novamente</button>
                    </div>
                </div>
            )}

            <div className="max-w-7xl mx-auto space-y-8">
                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <div className="flex items-center gap-2">
                            <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Gestão da Obra</h1>
                            <div title="Conectado ao Firestore">
                                <Database className="w-6 h-6 text-green-600" />
                            </div>
                        </div>
                        <p className="text-slate-500 mt-1">Configure a estrutura, serviços e materiais do projeto.</p>
                    </div>
                    <div className="flex items-center gap-3">
                        <button
                            onClick={loadData}
                            className="p-2 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors"
                            title="Recarregar dados"
                        >
                            <RefreshCw className="w-5 h-5 text-slate-600" />
                        </button>
                        <div className="relative group">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5 group-focus-within:text-blue-500 transition-colors" />
                            <input
                                type="text"
                                placeholder="Buscar em toda a obra..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="pl-10 pr-4 py-3 w-full md:w-80 bg-white border border-slate-200 rounded-xl shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                            />
                        </div>
                    </div>
                </div>

                {/* Navigation */}
                <div className="flex flex-wrap gap-2 bg-white p-2 rounded-2xl shadow-sm border border-slate-100">
                    <TabButton
                        active={activeTab === 'overview'}
                        onClick={() => setActiveTab('overview')}
                        icon={<LayoutDashboard className="w-4 h-4" />}
                        label="Visão Geral"
                    />
                    <TabButton
                        active={activeTab === 'vinculos'}
                        onClick={() => setActiveTab('vinculos')}
                        icon={<ArrowUpRight className="w-4 h-4" />}
                        label="Vínculos"
                    />
                    <div className="w-px h-8 bg-slate-200 mx-2 self-center hidden md:block" />
                    <TabButton
                        active={activeTab === 'fases'}
                        onClick={() => setActiveTab('fases')}
                        icon={<Layers className="w-4 h-4" />}
                        label="Fases"
                    />
                    <TabButton
                        active={activeTab === 'servicos'}
                        onClick={() => setActiveTab('servicos')}
                        icon={<Wrench className="w-4 h-4" />}
                        label="Serviços"
                    />
                    <TabButton
                        active={activeTab === 'grupos'}
                        onClick={() => setActiveTab('grupos')}
                        icon={<Boxes className="w-4 h-4" />}
                        label="Grupos"
                    />
                    <TabButton
                        active={activeTab === 'materiais'}
                        onClick={() => setActiveTab('materiais')}
                        icon={<Package className="w-4 h-4" />}
                        label="Materiais"
                    />
                </div>

                {/* Content Area */}
                <div className="min-h-[500px]">
                    {activeTab === 'overview' && renderOverview()}

                    {activeTab === 'vinculos' && <RelationshipManager />}

                    {activeTab === 'fases' && renderList(filteredFases, 'fases', (fase: Fase) => (
                        <div>
                            <div className="flex items-center gap-2 mb-1">
                                <span className="bg-slate-100 text-slate-600 text-xs font-bold px-2 py-1 rounded-md">#{fase.cronologia}</span>
                                <h3 className="font-semibold text-slate-900">{fase.nome}</h3>
                            </div>
                            <p className="text-sm text-slate-500">{fase.descricao || 'Sem descrição'}</p>
                        </div>
                    ))}

                    {activeTab === 'servicos' && renderServicosTab()}

                    {activeTab === 'grupos' && renderGruposTab()}

                    {activeTab === 'materiais' && renderMateriaisTab()}
                </div>
            </div>

            {/* Modals */}
            <Modal />
        </div>
    );
}

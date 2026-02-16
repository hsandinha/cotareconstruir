"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseAuth";
import { useAuth } from "@/lib/useAuth";

interface SupplierMessage {
    id: string;
    type: string;
    title: string;
    content: string;
    timestamp: string;
    isRead: boolean;
}

export function SupplierCommunicationSection() {
    const { user, initialized } = useAuth();
    const [messages, setMessages] = useState<SupplierMessage[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!initialized || !user) {
            setMessages([]);
            setLoading(false);
            return;
        }

        let mounted = true;

        const loadMessages = async () => {
            setLoading(true);
            setError(null);

            const { data, error: fetchError } = await supabase
                .from('notificacoes')
                .select('id, titulo, mensagem, tipo, lida, created_at')
                .eq('user_id', user.id)
                .order('created_at', { ascending: false });

            if (!mounted) return;

            if (fetchError) {
                setError('Não foi possível carregar as mensagens.');
                setMessages([]);
                setLoading(false);
                return;
            }

            setMessages(
                (data || []).map((item: any) => ({
                    id: item.id,
                    type: item.tipo || 'system',
                    title: item.titulo || 'Notificação',
                    content: item.mensagem || '',
                    timestamp: item.created_at ? new Date(item.created_at).toLocaleString('pt-BR') : '',
                    isRead: Boolean(item.lida),
                }))
            );

            setLoading(false);
        };

        loadMessages();

        return () => {
            mounted = false;
        };
    }, [initialized, user]);

    const markAllAsRead = async () => {
        if (!user) return;

        const unreadIds = messages.filter(m => !m.isRead).map(m => m.id);
        if (unreadIds.length === 0) return;

        const { error: updateError } = await supabase
            .from('notificacoes')
            .update({ lida: true, data_leitura: new Date().toISOString() })
            .in('id', unreadIds);

        if (updateError) {
            setError('Não foi possível marcar as mensagens como lidas.');
            return;
        }

        setMessages(prev => prev.map(message => ({ ...message, isRead: true })));
    };

    const getMessageIcon = (type: string) => {
        switch (type) {
            case 'system':
                return (
                    <svg className="h-5 w-5 text-blue-500" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                    </svg>
                );
            case 'alert':
                return (
                    <svg className="h-5 w-5 text-red-500" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                );
            case 'notification':
                return (
                    <svg className="h-5 w-5 text-green-500" viewBox="0 0 20 20" fill="currentColor">
                        <path d="M10 2a6 6 0 00-6 6v3.586l-.707.707A1 1 0 004 14h12a1 1 0 00.707-1.707L16 11.586V8a6 6 0 00-6-6zM10 18a3 3 0 01-3-3h6a3 3 0 01-3 3z" />
                    </svg>
                );
            default:
                return null;
        }
    };

    const getMessageBgColor = (type: string) => {
        switch (type) {
            case 'system': return 'bg-blue-50 border-blue-200';
            case 'alert': return 'bg-red-50 border-red-200';
            case 'notification': return 'bg-green-50 border-green-200';
            default: return 'bg-gray-50 border-gray-200';
        }
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h3 className="text-lg font-medium text-gray-900">Comunicação e Suporte</h3>
                <p className="mt-1 text-sm text-gray-600">
                    Central de mensagens, alertas do sistema e canal de suporte
                </p>
            </div>

            {/* Regras de comunicação */}
            <div className="bg-white border border-gray-200 rounded-lg p-6">
                <h4 className="text-base font-medium text-gray-900 mb-4">Regras de Comunicação</h4>
                <div className="space-y-3 text-sm">
                    <div className="flex items-start space-x-3">
                        <div className="w-2 h-2 bg-red-500 rounded-full mt-2"></div>
                        <div>
                            <span className="font-medium text-red-700">Proibido:</span>
                            <span className="text-gray-700"> Compartilhar números de telefone, e-mail ou qualquer forma de contato direto nas propostas</span>
                        </div>
                    </div>
                    <div className="flex items-start space-x-3">
                        <div className="w-2 h-2 bg-yellow-500 rounded-full mt-2"></div>
                        <div>
                            <span className="font-medium text-yellow-700">Monitoramento:</span>
                            <span className="text-gray-700"> IA monitora todas as comunicações para detectar tentativas de contato direto</span>
                        </div>
                    </div>
                    <div className="flex items-start space-x-3">
                        <div className="w-2 h-2 bg-orange-500 rounded-full mt-2"></div>
                        <div>
                            <span className="font-medium text-orange-700">Penalidades:</span>
                            <span className="text-gray-700"> Reincidência pode resultar em multas ou exclusão do cadastro</span>
                        </div>
                    </div>
                    <div className="flex items-start space-x-3">
                        <div className="w-2 h-2 bg-green-500 rounded-full mt-2"></div>
                        <div>
                            <span className="font-medium text-green-700">Liberado:</span>
                            <span className="text-gray-700"> Contato direto apenas após aprovação da proposta pelo cliente</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Central de mensagens */}
            <div className="bg-white border border-gray-200 rounded-lg">
                <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
                    <h4 className="text-base font-medium text-gray-900">Central de Mensagens</h4>
                    <button onClick={markAllAsRead} className="text-sm text-blue-600 hover:text-blue-800">Marcar todas como lidas</button>
                </div>
                <div className="divide-y divide-gray-200">
                    {loading && (
                        <div className="p-6 text-sm text-gray-500">Carregando mensagens...</div>
                    )}

                    {!loading && error && (
                        <div className="p-6 text-sm text-red-700 bg-red-50">{error}</div>
                    )}

                    {!loading && !error && messages.length === 0 && (
                        <div className="p-6 text-sm text-gray-500">Nenhuma mensagem registrada.</div>
                    )}

                    {!loading && !error && messages.map((message) => (
                        <div key={message.id} className={`p-6 ${!message.isRead ? 'bg-blue-50' : ''}`}>
                            <div className="flex items-start space-x-4">
                                <div className="flex-shrink-0">
                                    {getMessageIcon(message.type)}
                                </div>
                                <div className="flex-1">
                                    <div className="flex items-center justify-between mb-1">
                                        <h5 className="text-sm font-medium text-gray-900">{message.title}</h5>
                                        <div className="flex items-center space-x-2">
                                            <span className="text-xs text-gray-500">{message.timestamp}</span>
                                            {!message.isRead && (
                                                <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                                            )}
                                        </div>
                                    </div>
                                    <p className="text-sm text-gray-700">{message.content}</p>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Canal de suporte */}
            <div className="bg-white border border-gray-200 rounded-lg p-6">
                <h4 className="text-base font-medium text-gray-900 mb-4">Canal de Suporte</h4>
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Assunto</label>
                        <select className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500">
                            <option value="">Selecione o assunto</option>
                            <option value="duvida-tecnica">Dúvida Técnica</option>
                            <option value="problema-sistema">Problema no Sistema</option>
                            <option value="questao-comercial">Questão Comercial</option>
                            <option value="sugestao">Sugestão</option>
                            <option value="outro">Outro</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Mensagem</label>
                        <textarea
                            rows={4}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="Descreva sua dúvida, problema ou sugestão..."
                        />
                    </div>
                    <div className="flex justify-end">
                        <button className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700">
                            Enviar Mensagem
                        </button>
                    </div>
                </div>
            </div>

            {/* Contatos de emergência */}
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
                <h4 className="text-base font-medium text-gray-900 mb-3">Contatos de Emergência</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                    <div>
                        <span className="font-medium text-gray-700">Suporte Técnico:</span>
                        <div className="text-gray-900">suporte@cotareconstruir.com</div>
                    </div>
                    <div>
                        <span className="font-medium text-gray-700">Comercial:</span>
                        <div className="text-gray-900">comercial@cotareconstruir.com</div>
                    </div>
                    <div>
                        <span className="font-medium text-gray-700">WhatsApp Suporte:</span>
                        <div className="text-gray-900">(11) 9999-9999</div>
                    </div>
                    <div>
                        <span className="font-medium text-gray-700">Horário:</span>
                        <div className="text-gray-900">Segunda a Sexta, 8h às 18h</div>
                    </div>
                </div>
            </div>
        </div>
    );
}
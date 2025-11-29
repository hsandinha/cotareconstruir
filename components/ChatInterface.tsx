"use client";

import { useState, useEffect, useRef } from "react";
import { XMarkIcon, PaperAirplaneIcon } from "@heroicons/react/24/outline";

interface Message {
    id: string;
    sender: "me" | "other";
    text: string;
    timestamp: string;
}

interface ChatInterfaceProps {
    recipientName: string;
    onClose: () => void;
    isOpen: boolean;
    initialMessage?: string;
}

export function ChatInterface({ recipientName, onClose, isOpen, initialMessage }: ChatInterfaceProps) {
    const [messages, setMessages] = useState<Message[]>([
        {
            id: "1",
            sender: "other",
            text: initialMessage || `Olá! Sou o representante do ${recipientName}. Como posso ajudar com sua cotação?`,
            timestamp: "10:00"
        }
    ]);
    const [newMessage, setNewMessage] = useState("");
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages, isOpen]);

    const handleSendMessage = () => {
        if (!newMessage.trim()) return;

        const msg: Message = {
            id: Date.now().toString(),
            sender: "me",
            text: newMessage,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };

        setMessages([...messages, msg]);
        setNewMessage("");

        // Simular resposta
        setTimeout(() => {
            const reply: Message = {
                id: (Date.now() + 1).toString(),
                sender: "other",
                text: "Entendido. Vou verificar essa informação para você e retorno em breve.",
                timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            };
            setMessages(prev => [...prev, reply]);
        }, 2000);
    };

    if (!isOpen) return null;

    return (
        <div className="fixed bottom-4 right-4 w-80 md:w-96 bg-white rounded-2xl shadow-2xl border border-slate-200 z-50 flex flex-col overflow-hidden">
            {/* Header */}
            <div className="bg-slate-900 p-4 flex justify-between items-center">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-slate-700 rounded-full flex items-center justify-center text-white text-xs font-bold">
                        {recipientName.charAt(0)}
                    </div>
                    <div>
                        <h3 className="text-white font-medium text-sm">{recipientName}</h3>
                        <p className="text-slate-400 text-xs">Online agora</p>
                    </div>
                </div>
                <button onClick={onClose} className="text-slate-400 hover:text-white">
                    <XMarkIcon className="h-5 w-5" />
                </button>
            </div>

            {/* Messages Area */}
            <div className="flex-1 h-80 overflow-y-auto p-4 bg-slate-50 space-y-4">
                <div className="text-center text-xs text-slate-400 my-2">
                    Chat seguro e anônimo. Seus dados estão protegidos.
                </div>
                {messages.map((msg) => (
                    <div
                        key={msg.id}
                        className={`flex ${msg.sender === "me" ? "justify-end" : "justify-start"}`}
                    >
                        <div
                            className={`max-w-[80%] rounded-2xl px-4 py-2 text-sm ${msg.sender === "me"
                                ? "bg-blue-600 text-white rounded-br-none"
                                : "bg-white border border-slate-200 text-slate-700 rounded-bl-none"
                                }`}
                        >
                            <p>{msg.text}</p>
                            <p className={`text-[10px] mt-1 text-right ${msg.sender === "me" ? "text-blue-200" : "text-slate-400"
                                }`}>
                                {msg.timestamp}
                            </p>
                        </div>
                    </div>
                ))}
                <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className="p-3 bg-white border-t border-slate-100">
                <div className="flex items-center gap-2">
                    <input
                        type="text"
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && handleSendMessage()}
                        placeholder="Digite sua mensagem..."
                        className="flex-1 bg-slate-50 border border-slate-200 rounded-full px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <button
                        onClick={handleSendMessage}
                        disabled={!newMessage.trim()}
                        className="p-2 bg-blue-600 text-white rounded-full hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <PaperAirplaneIcon className="h-5 w-5" />
                    </button>
                </div>
            </div>
        </div>
    );
}

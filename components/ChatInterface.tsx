"use client";

import { useState, useEffect, useRef } from "react";
import { XMarkIcon, PaperAirplaneIcon, ExclamationTriangleIcon } from "@heroicons/react/24/outline";
import { auth, db } from "../lib/firebase";
import { createReport } from "../lib/services";
import { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp, where, getDoc, doc } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { sendEmail } from "../app/actions/email";

interface Message {
    id: string;
    senderId: string;
    text: string;
    timestamp: any; // Firestore Timestamp
    createdAt: any;
}

interface ChatInterfaceProps {
    recipientName: string;
    recipientId?: string;
    onClose: () => void;
    isOpen: boolean;
    initialMessage?: string;
    orderId?: string; // Used as chat room ID
    orderTitle?: string;
}

export function ChatInterface({ recipientName, recipientId, onClose, isOpen, initialMessage, orderId, orderTitle }: ChatInterfaceProps) {
    const [messages, setMessages] = useState<Message[]>([]);
    const [newMessage, setNewMessage] = useState("");
    const [currentUser, setCurrentUser] = useState<any>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    const handleReport = async () => {
        if (!currentUser || !recipientId) return;
        const reason = prompt("Por favor, descreva o motivo da denúncia:");
        if (reason) {
            try {
                await createReport(currentUser.uid, recipientId, "chat", "Comportamento no Chat", reason);
                alert("Denúncia enviada. Nossa equipe irá analisar.");
            } catch (error) {
                alert("Erro ao enviar denúncia.");
            }
        }
    };

    useEffect(() => {
        const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
            setCurrentUser(user);
        });
        return () => unsubscribeAuth();
    }, []);

    useEffect(() => {
        if (!isOpen || !orderId) return;

        // Query messages for this order
        // Assuming structure: chats/{orderId}/messages
        const q = query(
            collection(db, "chats", orderId, "messages"),
            orderBy("createdAt", "asc")
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const msgs: Message[] = [];
            snapshot.forEach((doc) => {
                msgs.push({ id: doc.id, ...doc.data() } as Message);
            });
            setMessages(msgs);
            scrollToBottom();
        });

        return () => unsubscribe();
    }, [isOpen, orderId]);

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const handleSendMessage = async () => {
        if (!newMessage.trim() || !currentUser || !orderId) return;

        // Security Checks
        const phoneRegex = /\b(?:\+?55\s?)?(?:\(?\d{2}\)?\s?)?(?:9\d{4}[-\s]?\d{4}|\d{4}[-\s]?\d{4})\b/;
        const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
        const suspiciousKeywords = ["pagamento por fora", "pix direto", "transferência direta", "desconto por fora", "cancela o pedido"];

        const text = newMessage.toLowerCase();

        if (phoneRegex.test(newMessage) || emailRegex.test(newMessage)) {
            alert("Por segurança, não é permitido compartilhar contatos diretos (telefone ou e-mail) pelo chat. Toda a negociação deve ocorrer pela plataforma.");
            return;
        }

        if (suspiciousKeywords.some(keyword => text.includes(keyword))) {
            const confirm = window.confirm("Sua mensagem contém termos que podem violar nossas políticas de uso (negociação fora da plataforma). Deseja enviar mesmo assim? A mensagem poderá ser auditada.");
            if (!confirm) return;
            // In a real app, we would flag this message in the database: flagged: true
        }

        try {
            await addDoc(collection(db, "chats", orderId, "messages"), {
                senderId: currentUser.uid,
                text: newMessage,
                createdAt: serverTimestamp(),
                timestamp: serverTimestamp() // Keep for compatibility if needed
            });

            // Notify recipient
            if (recipientId) {
                getDoc(doc(db, "users", recipientId)).then(async (recipientDoc) => {
                    const recipientData = recipientDoc.data();
                    if (recipientData?.email) {
                        await sendEmail({
                            to: recipientData.email,
                            subject: `Nova mensagem de ${currentUser.displayName || currentUser.email || "Usuário"} - Cota Reconstruir`,
                            html: `
                                <p>Você recebeu uma nova mensagem no chat sobre o pedido <strong>${orderTitle || orderId}</strong>.</p>
                                <p>Mensagem: "${newMessage}"</p>
                                <p>Acesse a plataforma para responder.</p>
                            `
                        });
                    }
                }).catch(err => console.error("Error sending notification:", err));
            }

            setNewMessage("");
        } catch (error) {
            console.error("Error sending message:", error);
        }
    };

    const handleKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSendMessage();
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed bottom-4 right-4 w-80 md:w-96 bg-white rounded-2xl shadow-2xl border border-slate-200 z-50 flex flex-col overflow-hidden h-[500px]">
            {/* Header */}
            <div className="bg-slate-900 p-4 flex justify-between items-center shrink-0">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-slate-700 rounded-full flex items-center justify-center text-white text-xs font-bold">
                        {recipientName.charAt(0)}
                    </div>
                    <div className="overflow-hidden">
                        <h3 className="text-white font-medium text-sm truncate max-w-[200px]">{recipientName}</h3>
                        {orderTitle && <p className="text-slate-400 text-xs truncate max-w-[200px]">{orderTitle}</p>}
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={handleReport}
                        className="text-slate-400 hover:text-red-400"
                        title="Denunciar"
                    >
                        <ExclamationTriangleIcon className="h-5 w-5" />
                    </button>
                    <button onClick={onClose} className="text-slate-400 hover:text-white">
                        <XMarkIcon className="h-5 w-5" />
                    </button>
                </div>
            </div>

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-4 bg-slate-50 space-y-4">
                <div className="text-center text-xs text-slate-400 my-2">
                    Chat seguro e anônimo. Seus dados estão protegidos.
                </div>

                {messages.length === 0 && initialMessage && (
                    <div className="flex justify-start">
                        <div className="max-w-[80%] rounded-2xl px-4 py-2 text-sm bg-white border border-slate-200 text-slate-700 rounded-bl-none">
                            {initialMessage}
                        </div>
                    </div>
                )}

                {messages.map((msg) => {
                    const isMe = msg.senderId === currentUser?.uid;
                    return (
                        <div
                            key={msg.id}
                            className={`flex ${isMe ? "justify-end" : "justify-start"}`}
                        >
                            <div
                                className={`max-w-[80%] rounded-2xl px-4 py-2 text-sm ${isMe
                                    ? "bg-blue-600 text-white rounded-br-none"
                                    : "bg-white border border-slate-200 text-slate-700 rounded-bl-none"
                                    }`}
                            >
                                <p>{msg.text}</p>
                                <p className={`text-[10px] mt-1 ${isMe ? "text-blue-100" : "text-slate-400"}`}>
                                    {msg.createdAt?.toDate ? msg.createdAt.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                                </p>
                            </div>
                        </div>
                    );
                })}
                <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className="p-4 bg-white border-t border-slate-100 shrink-0">
                <div className="flex gap-2">
                    <input
                        type="text"
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        onKeyDown={handleKeyPress}
                        placeholder="Digite sua mensagem..."
                        className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                    <button
                        onClick={handleSendMessage}
                        disabled={!newMessage.trim()}
                        className="p-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <PaperAirplaneIcon className="h-5 w-5" />
                    </button>
                </div>
            </div>
        </div>
    );
}
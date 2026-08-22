import type { MetadataRoute } from "next";

/**
 * Manifesto do PWA.
 *
 * `display: standalone` faz o app abrir sem a barra do navegador quando
 * instalado. Os atalhos aparecem ao segurar o ícone na tela inicial.
 */
export default function manifest(): MetadataRoute.Manifest {
    return {
        name: "Comprar & Construir",
        short_name: "C&C",
        description:
            "Cote materiais de obra com vários fornecedores, compare no mapa e emita a ordem de compra.",
        // Instalado, o app abre direto no login — sem passar pela página de
        // venda, que é para quem ainda não é cliente. Quem já tem sessão o
        // /login manda direto para o painel do seu perfil.
        start_url: "/login",
        // `id` fixo: sem ele, mudar o start_url faria alguns navegadores
        // tratarem como um app diferente e duplicarem o ícone de quem já
        // tinha instalado.
        id: "/",
        // Escopo na raiz para a navegação interna (landing, ajuda, termos)
        // continuar dentro do app em vez de abrir o navegador.
        scope: "/",
        display: "standalone",
        orientation: "portrait",
        background_color: "#FAF8F5",
        theme_color: "#F97316",
        lang: "pt-BR",
        categories: ["business", "productivity"],
        icons: [
            { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
            { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
            { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
        shortcuts: [
            { name: "Nova cotação", short_name: "Cotar", url: "/dashboard/cliente?tab=cotacao" },
            { name: "Meus pedidos", short_name: "Pedidos", url: "/dashboard/cliente?tab=pedidos" },
        ],
    };
}

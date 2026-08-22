/**
 * Service worker do Comprar & Construir.
 *
 * Estratégia deliberadamente conservadora: o app trabalha com preços,
 * propostas e pedidos que mudam a todo momento — servir isso de cache
 * mostraria número errado. Então:
 *
 *   - navegação e API  → sempre rede; só cai no cache se estiver offline
 *   - estáticos (_next/static, ícones, fontes) → cache primeiro, são imutáveis
 *   - nada de POST/PUT/DELETE em cache
 */

const VERSAO = 'cc-v1';
const CACHE_ESTATICO = `${VERSAO}-estatico`;
const CACHE_PAGINAS = `${VERSAO}-paginas`;
const PAGINA_OFFLINE = '/offline';

const ESSENCIAIS = ['/offline', '/icons/icon-192.png'];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_ESTATICO)
            .then((cache) => cache.addAll(ESSENCIAIS))
            .then(() => self.skipWaiting())
            .catch(() => self.skipWaiting())
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys()
            .then((chaves) => Promise.all(
                chaves.filter((c) => !c.startsWith(VERSAO)).map((c) => caches.delete(c))
            ))
            .then(() => self.clients.claim())
    );
});

const ehEstatico = (url) =>
    url.pathname.startsWith('/_next/static/')
    || url.pathname.startsWith('/icons/')
    || /\.(?:woff2?|ttf|otf|png|jpg|jpeg|webp|svg|ico)$/i.test(url.pathname);

self.addEventListener('fetch', (event) => {
    const { request } = event;

    // Só GET entra em cache; escrita nunca
    if (request.method !== 'GET') return;

    const url = new URL(request.url);

    // Não interfere em outro domínio (Supabase, fontes do Google)
    if (url.origin !== self.location.origin) return;

    // Chamadas de API sempre vão à rede — dado velho aqui é dado errado
    if (url.pathname.startsWith('/api/')) return;

    if (ehEstatico(url)) {
        event.respondWith(
            caches.match(request).then((emCache) => {
                if (emCache) return emCache;
                return fetch(request).then((resposta) => {
                    if (resposta.ok) {
                        const copia = resposta.clone();
                        caches.open(CACHE_ESTATICO).then((cache) => cache.put(request, copia));
                    }
                    return resposta;
                });
            })
        );
        return;
    }

    // Navegação: rede primeiro, cache como rede de segurança
    if (request.mode === 'navigate') {
        event.respondWith(
            fetch(request)
                .then((resposta) => {
                    if (resposta.ok) {
                        const copia = resposta.clone();
                        caches.open(CACHE_PAGINAS).then((cache) => cache.put(request, copia));
                    }
                    return resposta;
                })
                .catch(async () => {
                    const emCache = await caches.match(request);
                    return emCache || caches.match(PAGINA_OFFLINE);
                })
        );
    }
});

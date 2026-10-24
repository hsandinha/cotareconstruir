import '@testing-library/jest-dom'
import { TextDecoder, TextEncoder } from 'util';

// jsdom não traz TextEncoder/TextDecoder, que o Node e o browser têm. Sem
// isso, qualquer código que decodifica bytes (leitura de CSV, por exemplo)
// quebra só dentro do teste.
Object.assign(globalThis, {
    TextEncoder: globalThis.TextEncoder ?? TextEncoder,
    TextDecoder: globalThis.TextDecoder ?? TextDecoder,
});

// `lib/supabase.ts` cria o cliente no topo do módulo e estoura sem URL. Com
// estes valores de mentira, qualquer lib do servidor pode ser importada num
// teste — o cliente não abre conexão nenhuma ao ser construído.
process.env.NEXT_PUBLIC_SUPABASE_URL ||= 'http://localhost:54321';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||= 'chave-de-teste';
// Sem service role de propósito: `supabaseAdmin` fica null e teste nenhum
// consegue tocar banco por acidente.

jest.mock('next/navigation', () => {
    return {
        useRouter: () => ({
            push: jest.fn(),
            replace: jest.fn(),
            prefetch: jest.fn(),
            back: jest.fn(),
            forward: jest.fn(),
            refresh: jest.fn(),
        }),
        usePathname: () => '/',
        useSearchParams: () => new URLSearchParams(),
        useParams: () => ({}),
    };
});

import '@testing-library/jest-dom'
import { TextDecoder, TextEncoder } from 'util';

// jsdom não traz TextEncoder/TextDecoder, que o Node e o browser têm. Sem
// isso, qualquer código que decodifica bytes (leitura de CSV, por exemplo)
// quebra só dentro do teste.
Object.assign(globalThis, {
    TextEncoder: globalThis.TextEncoder ?? TextEncoder,
    TextDecoder: globalThis.TextDecoder ?? TextDecoder,
});

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

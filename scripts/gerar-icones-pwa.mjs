/**
 * Gera os ícones do PWA a partir de public/logo.png.
 *
 * Rode sempre que trocar a logo:
 *   python3 -c "import PIL" && node scripts/gerar-icones-pwa.mjs
 *
 * A fonte da verdade é UMA só: public/logo.png. Os arquivos em
 * public/icons/ são derivados — o manifesto exige PNGs de tamanho fixo,
 * então não dá para apontar direto para a logo original.
 */
import { execFileSync } from 'node:child_process';

const script = `
from PIL import Image
src = Image.open('public/logo.png').convert('RGBA')
marca = src.crop(src.getbbox())          # tira a margem transparente
lado = max(marca.size)
quad = Image.new('RGBA', (lado, lado), (0,0,0,0))
quad.paste(marca, ((lado-marca.width)//2, (lado-marca.height)//2), marca)

PAPEL = (250, 248, 245, 255)   # #FAF8F5

def icone(destino, tamanho, margem):
    fundo = Image.new('RGBA', (tamanho, tamanho), PAPEL)
    alvo = int(tamanho * (1 - 2*margem))
    m = quad.resize((alvo, alvo), Image.LANCZOS)
    fundo.paste(m, ((tamanho-alvo)//2, (tamanho-alvo)//2), m)
    fundo.convert('RGB').save(destino, 'PNG')
    print(destino)

icone('public/icons/icon-512.png', 512, 0.16)
icone('public/icons/icon-192.png', 192, 0.16)
icone('public/icons/apple-touch-icon.png', 180, 0.14)
icone('public/icons/icon-maskable-512.png', 512, 0.26)  # folga p/ recorte circular do Android
`;

execFileSync('python3', ['-c', script], { stdio: 'inherit' });

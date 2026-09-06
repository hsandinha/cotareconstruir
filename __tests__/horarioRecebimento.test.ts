import { formatHorarioRecebimento } from '@/lib/ordemCompraDoc';

const dia = (enabled: boolean, startTime = '08:00', endTime = '17:00') => ({ enabled, startTime, endTime });

describe('horário de recebimento na Ordem de Compra', () => {
    it('agrupa dias seguidos com o mesmo horário', () => {
        expect(formatHorarioRecebimento({
            segunda: dia(true), terca: dia(true), quarta: dia(true),
            quinta: dia(true), sexta: dia(true),
            sabado: dia(false), domingo: dia(false),
        })).toBe('Seg a Sex 08:00–17:00 · Sáb e Dom fechado');
    });

    it('separa quando o horário muda no meio da semana', () => {
        expect(formatHorarioRecebimento({
            segunda: dia(true), terca: dia(true), quarta: dia(true), quinta: dia(true),
            sexta: dia(true, '08:00', '12:00'),
        })).toBe('Seg a Qui 08:00–17:00 · Sex 08:00–12:00');
    });

    it('aceita as chaves em inglês', () => {
        expect(formatHorarioRecebimento({
            monday: dia(true), tuesday: dia(true), saturday: dia(false),
        })).toBe('Seg e Ter 08:00–17:00 · Sáb fechado');
    });

    it('trata um único dia', () => {
        expect(formatHorarioRecebimento({ segunda: dia(true) })).toBe('Seg 08:00–17:00');
    });

    it('devolve null quando não há horário, em vez de "[object Object]"', () => {
        // Era esse o defeito: o JSON ia direto para o documento
        expect(formatHorarioRecebimento(null)).toBeNull();
        expect(formatHorarioRecebimento(undefined)).toBeNull();
        expect(formatHorarioRecebimento({})).toBeNull();
        expect(formatHorarioRecebimento('seg a sex')).toBeNull();
    });

    it('considera fechado o dia marcado sem horário', () => {
        expect(formatHorarioRecebimento({
            segunda: { enabled: true, startTime: '', endTime: '' },
        })).toBe('Seg fechado');
    });
});

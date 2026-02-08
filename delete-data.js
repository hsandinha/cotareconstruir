const { createClient } = require('@supabase/supabase-js');
const supabase = createClient('https://rboauvtemdlislypnggq.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJib2F1dnRlbWRsaXNseXBuZ2dxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTA4MzQ5NywiZXhwIjoyMDg0NjU5NDk3fQ.MynE4KL4xC_nXK2BhOV81eOmIPTi5TFssCySFQS7Eec');

(async () => {
    // Verificar antes
    const { data: servicos } = await supabase.from('servicos').select('*');
    const { data: grupos } = await supabase.from('grupos_insumo').select('*');
    console.log('Servicos antes:', servicos?.length || 0);
    console.log('Grupos de insumo antes:', grupos?.length || 0);

    // Deletar servicos
    console.log('\nDeletando servicos...');
    const { error: e1 } = await supabase.from('servicos').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    if (e1) console.log('Erro:', e1.message);
    else console.log('Servicos deletados!');

    // Deletar grupos de insumo
    console.log('\nDeletando grupos de insumo...');
    const { error: e2 } = await supabase.from('grupos_insumo').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    if (e2) console.log('Erro:', e2.message);
    else console.log('Grupos de insumo deletados!');

    // Verificar depois
    const { data: s2 } = await supabase.from('servicos').select('*');
    const { data: g2 } = await supabase.from('grupos_insumo').select('*');
    console.log('\nServicos restantes:', s2?.length || 0);
    console.log('Grupos de insumo restantes:', g2?.length || 0);
})();

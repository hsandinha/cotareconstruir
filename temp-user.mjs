import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
const env = Object.fromEntries(
  fs.readFileSync('.env.local','utf8').split('\n')
    .filter(l => l.includes('=') && !l.trim().startsWith('#'))
    .map(l => { const i=l.indexOf('='); return [l.slice(0,i).trim(), l.slice(i+1).trim().replace(/^["']|["']$/g,'')]; })
);
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth:{persistSession:false} });

const EMAIL = 'qa.responsividade.temp@comprareconstruir.com';
const SENHA = 'Qa#Temp-2026-Resp!x';

const acao = process.argv[2];

if (acao === 'criar') {
  // Criado direto pela service key, sem passar pelo /api/auth/signup:
  // assim não consome vaga da turma de lançamento nem dispara e-mail.
  const { data, error } = await admin.auth.admin.createUser({
    email: EMAIL, password: SENHA, email_confirm: true,
    user_metadata: { full_name: 'QA Responsividade (temporário)' },
  });
  if (error) { console.log('erro auth:', error.message); process.exit(1); }
  const uid = data.user.id;

  // Três papéis na mesma conta, para testar os três painéis
  const { error: e2 } = await admin.from('users').upsert({
    id: uid, email: EMAIL, nome: 'QA Responsividade (temporário)',
    role: 'admin', roles: ['cliente','fornecedor','admin'], status: 'active',
  }, { onConflict: 'id' });
  if (e2) console.log('erro users:', e2.message);

  console.log('CRIADO', uid);
  console.log('EMAIL', EMAIL);
}

if (acao === 'apagar') {
  const { data: u } = await admin.from('users').select('id, cliente_id').eq('email', EMAIL).maybeSingle();
  if (u) {
    if (u.cliente_id) await admin.from('clientes').delete().eq('id', u.cliente_id);
    await admin.from('clientes').delete().eq('user_id', u.id);
    await admin.from('lancamento_vagas').delete().eq('user_id', u.id);
    await admin.from('notificacoes').delete().eq('user_id', u.id);
    await admin.from('users').delete().eq('id', u.id);
    await admin.auth.admin.deleteUser(u.id);
    console.log('apagado:', u.id);
  } else console.log('nada em public.users');
  await admin.from('lista_espera').delete().eq('email', EMAIL);

  // Confere que não sobrou nada
  const { data: users } = await admin.auth.admin.listUsers({ page:1, perPage:1000 });
  const resta = users.users.filter(x => x.email === EMAIL);
  const { count: c1 } = await admin.from('users').select('*',{count:'exact',head:true}).eq('email', EMAIL);
  const { count: c2 } = await admin.from('clientes').select('*',{count:'exact',head:true}).eq('email', EMAIL);
  console.log(`VERIFICACAO -> auth:${resta.length} users:${c1} clientes:${c2}`);
}

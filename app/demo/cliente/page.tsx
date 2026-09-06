"use client";

import Image from "next/image";
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import {
  Bell,
  Building2,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock3,
  FileText,
  Hammer,
  MapPin,
  MessageCircle,
  PackageCheck,
  Plus,
  Search,
  ShieldCheck,
  Sparkles,
  Star,
  TrendingDown,
  Truck,
  UserRound,
} from "lucide-react";

type Scene = "inicio" | "obras" | "cotacao" | "pedidos" | "oportunidades" | "final";

const nav = [
  { scene: "inicio", label: "Cadastro & Perfil" },
  { scene: "obras", label: "Obras & Endereços" },
  { scene: "cotacao", label: "Nova Cotação" },
  { scene: "pedidos", label: "Meus Pedidos" },
  { scene: "oportunidades", label: "Oportunidades" },
] as const;

const sceneCopy: Record<Scene, { eyebrow: string; title: string; subtitle: string }> = {
  inicio: {
    eyebrow: "Tudo começa aqui",
    title: "Sua obra organizada em um só lugar",
    subtitle: "Dados, endereços, cotações e pedidos com visão simples e centralizada.",
  },
  obras: {
    eyebrow: "Planejamento sem improviso",
    title: "Acompanhe cada etapa da sua obra",
    subtitle: "Cronograma, progresso e endereço de entrega sempre atualizados.",
  },
  cotacao: {
    eyebrow: "Comprar ficou mais simples",
    title: "Crie uma cotação em poucos passos",
    subtitle: "Selecione a obra, adicione os materiais e envie para fornecedores qualificados.",
  },
  pedidos: {
    eyebrow: "Decisão com confiança",
    title: "Compare propostas lado a lado",
    subtitle: "Preço, frete, prazo e condições reunidos para você escolher melhor.",
  },
  oportunidades: {
    eyebrow: "Economia no momento certo",
    title: "Encontre ofertas para a sua região",
    subtitle: "Oportunidades relevantes para as etapas atuais da sua construção.",
  },
  final: {
    eyebrow: "Comprar & Construir",
    title: "Mais controle. Menos custo. Sua obra avança.",
    subtitle: "Conectamos sua necessidade aos fornecedores certos para transformar cotação em resultado.",
  },
};

function Stat({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: string; tone: string }) {
  return (
    <div className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
      <div className={`grid h-11 w-11 place-items-center rounded-xl ${tone}`}>{icon}</div>
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">{label}</p>
        <p className="mt-0.5 text-2xl font-bold text-slate-900">{value}</p>
      </div>
    </div>
  );
}

function ProfileScene() {
  return (
    <div className="grid grid-cols-[1.05fr_.95fr] gap-7">
      <section className="rounded-3xl border border-slate-200 bg-white p-7 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-blue-600">Perfil do cliente</p>
            <h2 className="mt-1 text-2xl font-bold text-slate-900">Construtora Horizonte</h2>
          </div>
          <div className="relative grid h-20 w-20 place-items-center rounded-full bg-blue-50">
            <span className="text-xl font-bold text-blue-700">92%</span>
            <div className="absolute inset-0 rounded-full border-[7px] border-blue-500 border-l-blue-100" />
          </div>
        </div>
        <div className="mt-7 grid grid-cols-2 gap-4">
          {[
            ["Responsável", "Marina Carvalho"],
            ["Tipo de cadastro", "Pessoa Jurídica"],
            ["Telefone", "(31) 99999-0000"],
            ["Cidade", "Belo Horizonte • MG"],
          ].map(([label, value]) => (
            <div key={label} className="rounded-2xl bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</p>
              <p className="mt-1.5 font-semibold text-slate-700">{value}</p>
            </div>
          ))}
        </div>
        <div className="mt-5 flex items-center gap-3 rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">
          <ShieldCheck className="h-5 w-5" /> Cadastro verificado e pronto para cotar
        </div>
      </section>

      <section className="overflow-hidden rounded-3xl bg-gradient-to-br from-blue-700 via-blue-600 to-cyan-500 p-7 text-white shadow-xl shadow-blue-600/20">
        <div className="flex h-full flex-col justify-between">
          <div>
            <div className="grid h-12 w-12 place-items-center rounded-2xl bg-white/15"><Sparkles /></div>
            <h3 className="mt-5 text-3xl font-bold leading-tight">Da necessidade à compra, sem perder tempo.</h3>
            <p className="mt-3 max-w-md text-base leading-relaxed text-blue-50">Centralize o que sua obra precisa e receba propostas de fornecedores que atendem sua região.</p>
          </div>
          <div className="mt-8 grid grid-cols-3 gap-3">
            {["Organize", "Compare", "Economize"].map((item, i) => (
              <div key={item} className="rounded-2xl bg-white/12 p-4 backdrop-blur">
                <span className="text-xs font-bold text-blue-100">0{i + 1}</span>
                <p className="mt-2 font-bold">{item}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

function WorksScene() {
  const etapas = [
    { label: "Fundação", done: true },
    { label: "Estrutura", done: true },
    { label: "Alvenaria", done: true },
    { label: "Instalações", done: false },
    { label: "Acabamentos", done: false },
  ];
  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-7 shadow-sm">
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3">
            <div className="grid h-12 w-12 place-items-center rounded-2xl bg-blue-100 text-blue-700"><Building2 /></div>
            <div><h2 className="text-2xl font-bold">Residencial Serra Azul</h2><p className="mt-1 flex items-center gap-1.5 text-sm text-slate-500"><MapPin className="h-4 w-4" /> Nova Lima • MG</p></div>
          </div>
        </div>
        <button className="flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-blue-600/20"><Plus className="h-4 w-4" /> Nova obra</button>
      </div>

      <div className="mt-7 grid grid-cols-[1.3fr_.7fr] gap-6">
        <div className="rounded-2xl bg-slate-50 p-6">
          <div className="flex items-center justify-between"><p className="font-bold text-slate-700">Progresso da construção</p><span className="rounded-full bg-blue-100 px-3 py-1 text-sm font-bold text-blue-700">62% concluído</span></div>
          <div className="mt-6 flex items-start">
            {etapas.map((etapa, index) => (
              <div key={etapa.label} className="relative flex flex-1 flex-col items-center text-center">
                {index < etapas.length - 1 && <div className={`absolute left-1/2 top-5 h-1 w-full ${etapa.done ? "bg-blue-500" : "bg-slate-200"}`} />}
                <div className={`relative z-10 grid h-11 w-11 place-items-center rounded-full border-4 border-white shadow ${etapa.done ? "bg-blue-600 text-white" : "bg-slate-200 text-slate-500"}`}>{etapa.done ? <Check className="h-5 w-5" /> : index + 1}</div>
                <p className={`mt-3 text-sm font-bold ${etapa.done ? "text-slate-800" : "text-slate-400"}`}>{etapa.label}</p>
              </div>
            ))}
          </div>
          <div className="mt-8 grid grid-cols-3 gap-3">
            {[["Próxima etapa", "Instalações"], ["Início previsto", "12 set 2026"], ["Antecedência", "15 dias"]].map(([a,b]) => <div key={a} className="rounded-xl border border-slate-200 bg-white p-4"><p className="text-xs font-semibold text-slate-400">{a}</p><p className="mt-1 font-bold text-slate-700">{b}</p></div>)}
          </div>
        </div>
        <div className="rounded-2xl border border-slate-200 p-6">
          <p className="text-sm font-bold text-slate-500">ENTREGA NA OBRA</p>
          <p className="mt-3 font-bold text-slate-800">Rua das Acácias, 240</p><p className="text-sm text-slate-500">Jardins • Nova Lima/MG</p>
          <div className="my-5 h-px bg-slate-200" />
          <div className="space-y-4 text-sm">
            <p className="flex items-center gap-3 text-slate-600"><Clock3 className="h-5 w-5 text-blue-600" /> Seg–Sex, 08h às 17h</p>
            <p className="flex items-center gap-3 text-slate-600"><Truck className="h-5 w-5 text-blue-600" /> Acesso para caminhões</p>
            <p className="flex items-center gap-3 text-emerald-700"><CheckCircle2 className="h-5 w-5" /> Endereço confirmado</p>
          </div>
        </div>
      </div>
    </section>
  );
}

function QuotationScene() {
  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-7 shadow-sm">
      <div className="flex items-center justify-between">
        {["Selecionar obra", "Adicionar materiais", "Revisar e enviar"].map((label, i) => (
          <div key={label} className="flex flex-1 items-center">
            <div className="flex items-center gap-3"><span className={`grid h-10 w-10 place-items-center rounded-full font-bold ${i < 2 ? "bg-blue-600 text-white" : "bg-blue-100 text-blue-700"}`}>{i < 1 ? <Check className="h-5 w-5" /> : i + 1}</span><div><p className="text-xs font-semibold text-slate-400">PASSO {i + 1}</p><p className="font-bold text-slate-700">{label}</p></div></div>
            {i < 2 && <div className="mx-6 h-px flex-1 bg-slate-200" />}
          </div>
        ))}
      </div>
      <div className="mt-7 grid grid-cols-[1fr_.65fr] gap-6">
        <div className="rounded-2xl bg-slate-50 p-6">
          <div className="flex items-center justify-between"><div><p className="text-sm font-bold text-blue-600">Materiais para instalações</p><h3 className="mt-1 text-xl font-bold">Monte sua lista de cotação</h3></div><div className="flex items-center rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-400"><Search className="mr-2 h-4 w-4" /> Buscar material</div></div>
          <div className="mt-5 space-y-3">
            {[
              ["Cimento CP II 50 kg", "120 sacos", "R$ 4.680,00"],
              ["Vergalhão CA-50 10 mm", "80 barras", "R$ 5.920,00"],
              ["Tubo PVC soldável 25 mm", "60 un.", "R$ 1.140,00"],
              ["Cabo flexível 2,5 mm²", "12 rolos", "R$ 3.360,00"],
            ].map(([name, qty, estimate]) => <div key={name} className="flex items-center gap-4 rounded-xl border border-slate-200 bg-white px-4 py-3"><div className="grid h-9 w-9 place-items-center rounded-lg bg-blue-50 text-blue-600"><PackageCheck className="h-5 w-5" /></div><div className="flex-1"><p className="font-bold text-slate-700">{name}</p><p className="text-xs text-slate-400">{qty}</p></div><p className="text-sm font-bold text-slate-600">{estimate}</p><CheckCircle2 className="h-5 w-5 text-emerald-500" /></div>)}
          </div>
        </div>
        <div className="flex flex-col rounded-2xl border border-blue-100 bg-blue-50 p-6">
          <p className="text-sm font-bold text-blue-700">RESUMO DA COTAÇÃO</p>
          <h3 className="mt-2 text-xl font-bold text-slate-900">Residencial Serra Azul</h3>
          <div className="mt-5 space-y-3 text-sm"><p className="flex justify-between"><span className="text-slate-500">Itens selecionados</span><b>4</b></p><p className="flex justify-between"><span className="text-slate-500">Estimativa</span><b>R$ 15.100,00</b></p><p className="flex justify-between"><span className="text-slate-500">Fornecedores na região</span><b className="text-emerald-600">18 encontrados</b></p></div>
          <div className="my-5 h-px bg-blue-200" />
          <p className="flex items-start gap-2 text-sm leading-relaxed text-blue-800"><ShieldCheck className="mt-0.5 h-5 w-5 shrink-0" /> Seus dados serão enviados apenas aos fornecedores qualificados.</p>
          <button className="mt-auto flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3.5 font-bold text-white shadow-lg shadow-blue-600/20">Revisar cotação <ChevronRight className="h-5 w-5" /></button>
        </div>
      </div>
    </section>
  );
}

function OrdersScene() {
  const suppliers = [
    { name: "Construmax", total: "R$ 13.980", freight: "Grátis", days: "3 dias", score: "4,9", best: true },
    { name: "Casa Forte", total: "R$ 14.420", freight: "R$ 180", days: "2 dias", score: "4,8", best: false },
    { name: "Depósito Minas", total: "R$ 14.150", freight: "R$ 320", days: "5 dias", score: "4,7", best: false },
  ];
  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-7 shadow-sm">
      <div className="flex items-center justify-between"><div><p className="text-sm font-bold text-blue-600">Cotação #CT-2026-184</p><h2 className="mt-1 text-2xl font-bold">Mapa comparativo de propostas</h2></div><span className="rounded-full bg-emerald-100 px-4 py-2 text-sm font-bold text-emerald-700">3 propostas recebidas</span></div>
      <div className="mt-6 grid grid-cols-[.7fr_1fr_1fr_1fr] overflow-hidden rounded-2xl border border-slate-200">
        <div className="bg-slate-50 p-5"><p className="text-xs font-bold text-slate-400">COMPARAR</p><div className="mt-10 space-y-8 text-sm font-semibold text-slate-500"><p>Valor dos itens</p><p>Frete</p><p>Prazo de entrega</p><p>Avaliação</p></div></div>
        {suppliers.map((s) => <div key={s.name} className={`relative border-l border-slate-200 p-5 ${s.best ? "bg-blue-50/70" : "bg-white"}`}>{s.best && <span className="absolute right-4 top-4 rounded-full bg-blue-600 px-3 py-1 text-[11px] font-bold text-white">MELHOR CUSTO</span>}<div className="grid h-11 w-11 place-items-center rounded-xl bg-slate-900 text-sm font-bold text-white">{s.name.split(" ").map(x=>x[0]).join("").slice(0,2)}</div><h3 className="mt-3 font-bold text-slate-800">{s.name}</h3><div className="mt-7 space-y-7"><p className="text-xl font-extrabold text-slate-900">{s.total}</p><p className={`font-bold ${s.freight === "Grátis" ? "text-emerald-600" : "text-slate-600"}`}>{s.freight}</p><p className="font-bold text-slate-600">{s.days}</p><p className="flex items-center gap-1 font-bold text-amber-500"><Star className="h-4 w-4 fill-current" /> {s.score}</p></div><button className={`mt-6 flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-bold ${s.best ? "bg-blue-600 text-white" : "border border-slate-200 text-slate-700"}`}><MessageCircle className="h-4 w-4" /> Negociar</button></div>)}
      </div>
      <div className="mt-4 flex items-center gap-2 text-sm font-semibold text-emerald-700"><TrendingDown className="h-5 w-5" /> Economia estimada de R$ 1.120 nesta compra</div>
    </section>
  );
}

function OpportunitiesScene() {
  const cards = [
    ["Cimento CP II 50 kg", "Construmax", "R$ 35,90", "-12%", "Termina em 2 dias"],
    ["Porcelanato 90×90", "Casa Forte", "R$ 78,50/m²", "-18%", "Últimas 42 caixas"],
    ["Tinta acrílica 18 L", "Cores & Cia", "R$ 289,00", "-15%", "Frete grátis"],
  ];
  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-7 shadow-sm">
      <div className="flex items-center justify-between"><div><p className="text-sm font-bold text-blue-600">Ofertas para Residencial Serra Azul</p><h2 className="mt-1 text-2xl font-bold">Oportunidades perto da sua obra</h2></div><span className="flex items-center gap-2 rounded-xl bg-slate-100 px-4 py-3 text-sm font-bold text-slate-600"><MapPin className="h-4 w-4 text-blue-600" /> até 35 km</span></div>
      <div className="mt-7 grid grid-cols-3 gap-5">
        {cards.map(([product, supplier, price, discount, note], i) => <div key={product} className="group overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"><div className={`relative h-28 ${["bg-gradient-to-br from-slate-700 to-slate-950","bg-gradient-to-br from-amber-200 to-orange-400","bg-gradient-to-br from-blue-500 to-indigo-700"][i]}`}><span className="absolute left-4 top-4 rounded-full bg-white px-3 py-1 text-xs font-extrabold text-emerald-700">{discount}</span><div className="absolute bottom-4 right-4 grid h-12 w-12 place-items-center rounded-2xl bg-white/15 text-white backdrop-blur"><Hammer /></div></div><div className="p-5"><p className="text-xs font-bold uppercase tracking-wide text-slate-400">{supplier}</p><h3 className="mt-2 text-lg font-bold text-slate-800">{product}</h3><p className="mt-4 text-2xl font-extrabold text-blue-700">{price}</p><p className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-slate-500"><Clock3 className="h-4 w-4" /> {note}</p><button className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-blue-50 px-4 py-3 text-sm font-bold text-blue-700">Aproveitar oferta <ChevronRight className="h-4 w-4" /></button></div></div>)}
      </div>
    </section>
  );
}

function FinalScene() {
  return (
    <div className="relative flex min-h-[510px] overflow-hidden rounded-[2rem] bg-slate-950 px-14 py-12 text-white shadow-2xl">
      <div className="absolute -right-32 -top-32 h-96 w-96 rounded-full bg-blue-600/40 blur-3xl" /><div className="absolute -bottom-40 left-1/3 h-96 w-96 rounded-full bg-cyan-500/20 blur-3xl" />
      <div className="relative z-10 flex max-w-3xl flex-col justify-center"><Image src="/logo.png" alt="Comprar & Construir" width={180} height={90} className="h-24 w-auto rounded-2xl bg-white object-contain p-2" /><p className="mt-7 text-sm font-bold uppercase tracking-[0.28em] text-cyan-300">Sua obra compra melhor</p><h2 className="mt-4 text-5xl font-extrabold leading-[1.08]">Cote, compare e economize.<br />Tudo em um só lugar.</h2><p className="mt-5 max-w-2xl text-lg leading-relaxed text-slate-300">Mais clareza para decidir. Mais agilidade para comprar. Mais tranquilidade para construir.</p><div className="mt-8 flex items-center gap-4"><div className="rounded-xl bg-blue-600 px-6 py-3.5 font-bold">Comece sua próxima cotação</div><span className="text-sm font-semibold text-slate-400">Comprar & Construir</span></div></div>
      <div className="relative z-10 ml-auto flex w-80 flex-col justify-center gap-4">{[[FileText,"Cotações em minutos"],[TrendingDown,"Melhores condições"],[Truck,"Entrega na sua obra"]].map(([Icon,label]) => { const I = Icon as typeof FileText; return <div key={label as string} className="flex items-center gap-4 rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur"><div className="grid h-11 w-11 place-items-center rounded-xl bg-blue-500/20 text-cyan-300"><I /></div><p className="font-bold">{label as string}</p></div>;})}</div>
    </div>
  );
}

function ClienteVideoDemoContent() {
  const params = useSearchParams();
  // useSearchParams pode devolver null na renderização do servidor
  const requested = params?.get("scene") as Scene | null;
  const scene: Scene = requested && sceneCopy[requested] ? requested : "inicio";
  const copy = sceneCopy[scene];
  const body = scene === "inicio" ? <ProfileScene /> : scene === "obras" ? <WorksScene /> : scene === "cotacao" ? <QuotationScene /> : scene === "pedidos" ? <OrdersScene /> : scene === "oportunidades" ? <OpportunitiesScene /> : <FinalScene />;

  return (
    <main className="min-h-screen overflow-hidden bg-slate-100 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex h-[76px] max-w-[1440px] items-center justify-between px-8">
          <div className="flex items-center gap-3"><Image src="/logo.png" alt="Comprar & Construir" width={120} height={58} className="h-14 w-auto object-contain" /><div className="h-8 w-px bg-slate-200" /><span className="text-sm font-semibold text-slate-500">Ambiente do cliente</span></div>
          <div className="flex items-center gap-4"><button className="grid h-10 w-10 place-items-center rounded-full bg-slate-100 text-slate-500"><Bell className="h-5 w-5" /></button><div className="flex items-center gap-3"><div className="grid h-11 w-11 place-items-center rounded-full bg-blue-600 font-bold text-white">MC</div><div><p className="text-xs text-slate-400">Bem-vinda</p><p className="text-sm font-bold">Marina Carvalho</p></div></div></div>
        </div>
      </header>

      {scene !== "final" && <nav className="border-b border-slate-200 bg-white"><div className="mx-auto flex max-w-[1440px] items-center gap-8 px-8">{nav.map((item) => <div key={item.scene} className={`border-b-2 px-1 py-4 text-sm font-bold ${scene === item.scene ? "border-blue-600 text-blue-700" : "border-transparent text-slate-400"}`}>{item.label}</div>)}</div></nav>}

      <div className="mx-auto max-w-[1440px] px-8 pb-8 pt-7">
        {scene !== "final" && <div className="mb-6 flex items-end justify-between"><div><p className="text-xs font-extrabold uppercase tracking-[0.22em] text-blue-600">{copy.eyebrow}</p><h1 className="mt-2 text-3xl font-extrabold tracking-tight">{copy.title}</h1><p className="mt-1.5 text-base text-slate-500">{copy.subtitle}</p></div><div className="grid grid-cols-4 gap-3"><Stat icon={<UserRound className="h-5 w-5" />} label="Perfis" value="1" tone="bg-blue-100 text-blue-700" /><Stat icon={<Building2 className="h-5 w-5" />} label="Obras" value="3" tone="bg-emerald-100 text-emerald-700" /><Stat icon={<FileText className="h-5 w-5" />} label="Cotações" value="6" tone="bg-violet-100 text-violet-700" /><Stat icon={<PackageCheck className="h-5 w-5" />} label="Pedidos" value="4" tone="bg-amber-100 text-amber-700" /></div></div>}
        {body}
      </div>
    </main>
  );
}

/**
 * `useSearchParams` obriga uma fronteira de Suspense: sem ela o build do
 * Next falha ao pré-renderizar esta página (missing-suspense-with-csr-bailout).
 */
export default function ClienteVideoDemoPage() {
  return (
    <Suspense fallback={null}>
      <ClienteVideoDemoContent />
    </Suspense>
  );
}

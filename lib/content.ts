import {
  faBrain,
  faCheck,
  faChartLine,
  faExclamationTriangle,
  faEyeSlash,
  faGraduationCap,
  faHandshake,
  faMedal,
  faPiggyBank,
  faRocket,
  faShield,
  faShieldHalved,
  faScaleBalanced,
  faTruck,
  faUser,
} from "@fortawesome/free-solid-svg-icons";

export const navLinks = [
  { label: "Solução", href: "#solucao" },
  { label: "Metodologia", href: "#metodologia" },
  { label: "Benefícios", href: "#beneficios" },
  { label: "Contato", href: "#contato" },
] as const;

export const heroStats = [
  { value: "31%", label: "Economia Máxima" },
  { value: "30+", label: "Anos de Experiência" },
  { value: "100%", label: "Transparência" },
] as const;

export const challenges = [
  {
    id: "problema-1",
    icon: faExclamationTriangle,
    colorClass: "text-red-600",
    accentClass: "bg-red-100",
    title: "Complexidade Excessiva",
    description:
      "Gestão manual de múltiplas cotações cria um labirinto administrativo que consome recursos valiosos.",
  },
  {
    id: "problema-2",
    icon: faGraduationCap,
    colorClass: "text-orange-600",
    accentClass: "bg-orange-100",
    title: "Falta de Especialização",
    description:
      "Lacuna crítica na formação acadêmica deixa profissionais sem conhecimento em gestão de suprimentos.",
  },
  {
    id: "problema-3",
    icon: faShieldHalved,
    colorClass: "text-yellow-600",
    accentClass: "bg-yellow-100",
    title: "Riscos Operacionais",
    description:
      "Decisões inadequadas levam a retrabalhos, comprometem segurança e reduzem valor do ativo.",
  },
  {
    id: "problema-4",
    icon: faHandshake,
    colorClass: "text-purple-600",
    accentClass: "bg-purple-100",
    title: "Poder Limitado",
    description:
      "Clientes individuais não acessam preços competitivos por falta de volume consolidado.",
  },
] as const;

export const solutionHighlights = [
  {
    icon: faPiggyBank,
    accentClass: "bg-blue-100 text-blue-600",
    title: "Economia de até 31%",
    description: "Negociações alavancadas por volume e rede exclusiva de fornecedores homologados.",
  },
  {
    icon: faMedal,
    accentClass: "bg-green-100 text-green-600",
    title: "Qualidade Garantida",
    description: "Seleção criteriosa de fornecedores especializados e análise técnica rigorosa.",
  },
  {
    icon: faRocket,
    accentClass: "bg-purple-100 text-purple-600",
    title: "Eficiência Máxima",
    description: "Automação completa e logística just-in-time, integradas ao cronograma da obra.",
  },
] as const;

export const clientProcess = [
  "Insere lista de materiais na plataforma.",
  "Sistema processa e segmenta automaticamente.",
  "Recebe mapa comparativo consolidado.",
] as const;

export const supplierProcess = [
  "Recebe demanda via Cotar e Construir.",
  "Preenche proposta diretamente na plataforma.",
  "Calcula frete por região com dados precisos.",
] as const;

export const intelligencePoints = [
  { icon: faEyeSlash, label: "Duplo anonimato estratégico." },
  { icon: faScaleBalanced, label: "Competição saudável controlada." },
  { icon: faShield, label: "Segurança e transparência em toda a jornada." },
] as const;

export const benefitPillars = [
  {
    id: "economia-real",
    borderClass: "border-blue-500",
    accentClass: "text-blue-500",
    title: "Economia Real e Mensurável",
    description:
      "Otimização de CAPEX com reduções comprovadas de até 31% através de negociações profissionais por volume.",
    metricLabel: "economia máxima alcançada",
    metricValue: "31%",
  },
  {
    id: "eficiencia-operacional",
    borderClass: "border-emerald-500",
    accentClass: "text-emerald-500",
    title: "Eficiência Operacional Máxima",
    description:
      "Gestão completa de suprimentos com planejamento estratégico e entrega just-in-time para manter o cronograma.",
    metricLabel: "aderência ao cronograma",
    metricValue: "100%",
  },
  {
    id: "qualidade-seguranca",
    borderClass: "border-purple-500",
    accentClass: "text-purple-500",
    title: "Qualidade e Segurança Técnica",
    description:
      "Seleção criteriosa de fornecedores homologados e análise técnica detalhada de cada item da obra.",
    metricLabel: "tolerância a falhas",
    metricValue: "0%",
  },
] as const;

export const footerLinks = {
  solution: ["Como Funciona", "Metodologia", "Benefícios", "Casos de Sucesso"],
  company: ["Sobre Nós", "Nossa Equipe", "Carreiras", "Imprensa"],
} as const;

export const heroHighlights = {
  label: "Gestão Inteligente de Suprimentos",
  title: "Transforme Suas <span class='text-blue-200'>Compras</span> em Vantagem Estratégica",
  description:
    "A primeira plataforma que converte a gestão de suprimentos da construção civil em um diferencial competitivo, garantindo economia de até 31% nos insumos.",
  primaryCta: {
    label: "Solicitar Cotação Gratuita",
    href: "#contato",
  },
  secondaryCta: {
    label: "Ver Como Funciona",
    href: "#solucao",
  },
  spotlight: {
    headline: "Economia Garantida",
    subheadline: "Resultados mensuráveis",
    icon: faChartLine,
  },
  image: {
    src: "https://storage.googleapis.com/uxpilot-auth.appspot.com/49b2095347-de97a77e31bcfcb902fd.png",
    alt: "Construção civil moderna com tecnologia",
  },
} as const;

export const solutionMedia = {
  image: {
    src: "https://storage.googleapis.com/uxpilot-auth.appspot.com/1bb0e0a9ad-9f8ad122265936e3d17d.png",
    alt: "Dashboard de gestão de suprimentos",
  },
  economyBadge: {
    label: "31%",
    caption: "Economia",
  },
  automationBadge: {
    label: "Processo Automatizado",
  },
} as const;

export const benefitMedia = {
  image: {
    src: "https://storage.googleapis.com/uxpilot-auth.appspot.com/03e54f61d0-4bea83ba3ca22d842f8f.png",
    alt: "Gráficos de performance de suprimentos",
  },
  experienceBadge: {
    label: "30+",
    caption: "Anos de experiência",
  },
} as const;

export const ctaContent = {
  title: "Pronto para transformar sua obra?",
  description:
    "Junte-se aos profissionais que convertem a gestão de suprimentos em vantagem competitiva com previsibilidade, economia e performance.",
  primaryButton: {
    label: "Solicitar Cotação Gratuita",
    href: "#contato",
  },
  secondaryButton: {
    label: "Agendar Demonstração",
    href: "#solucao",
  },
  highlights: [
    { title: "Gratuito", subtitle: "Primeira cotação" },
    { title: "Sem Compromisso", subtitle: "Teste a metodologia" },
    { title: "Resultados", subtitle: "Garantidos" },
  ],
} as const;

export const floatingWhatsApp = {
  phone: "5511999999999",
  message: "Olá! Gostaria de falar com a Cotar e Construir.",
  label: "Fale pelo WhatsApp",
} as const;

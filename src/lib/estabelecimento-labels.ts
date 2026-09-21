export interface EstabelecimentoLabels {
  tipo: string;
  nome: string;
  profissional: string;
  profissionais: string;
  servico: string;
  servicos: string;
  loginTitle: string;
}

export const TIPOS_ESTABELECIMENTO = [
  { value: "barbearia", label: "Barbearia", icon: "✂️" },
  { value: "clinica_estetica", label: "Clínica Estética", icon: "💆" },
  { value: "clinica_odontologica", label: "Clínica Odontológica", icon: "🦷" },
  { value: "otica", label: "Ótica", icon: "👓" },
  { value: "oficina_mecanica", label: "Oficina Mecânica", icon: "🔧" },
  { value: "padaria", label: "Padaria", icon: "🍞" },
  { value: "restaurante", label: "Restaurante", icon: "🍽️" },
  { value: "salao_beleza", label: "Salão de Beleza", icon: "💇" },
  { value: "pet_shop", label: "Pet Shop", icon: "🐾" },
  { value: "outro", label: "Outro", icon: "🏪" },
];

const LABELS_MAP: Record<string, EstabelecimentoLabels> = {
  barbearia: {
    tipo: "barbearia",
    nome: "Barbearia",
    profissional: "Barbeiro",
    profissionais: "Barbeiros",
    servico: "Serviço",
    servicos: "Serviços",
    loginTitle: "Painel Barbearia",
  },
  clinica_estetica: {
    tipo: "clinica_estetica",
    nome: "Clínica Estética",
    profissional: "Esteticista",
    profissionais: "Esteticistas",
    servico: "Procedimento",
    servicos: "Procedimentos",
    loginTitle: "Painel Estética",
  },
  clinica_odontologica: {
    tipo: "clinica_odontologica",
    nome: "Clínica Odontológica",
    profissional: "Dentista",
    profissionais: "Dentistas",
    servico: "Procedimento",
    servicos: "Procedimentos",
    loginTitle: "Painel Odontológico",
  },
  otica: {
    tipo: "otica",
    nome: "Ótica",
    profissional: "Atendente",
    profissionais: "Atendentes",
    servico: "Serviço",
    servicos: "Serviços",
    loginTitle: "Painel Ótica",
  },
  oficina_mecanica: {
    tipo: "oficina_mecanica",
    nome: "Oficina Mecânica",
    profissional: "Mecânico",
    profissionais: "Mecânicos",
    servico: "Serviço",
    servicos: "Serviços",
    loginTitle: "Painel Oficina",
  },
  padaria: {
    tipo: "padaria",
    nome: "Padaria",
    profissional: "Atendente",
    profissionais: "Atendentes",
    servico: "Produto",
    servicos: "Produtos",
    loginTitle: "Painel Padaria",
  },
  restaurante: {
    tipo: "restaurante",
    nome: "Restaurante",
    profissional: "Garçom",
    profissionais: "Garçons",
    servico: "Prato",
    servicos: "Pratos",
    loginTitle: "Painel Restaurante",
  },
  salao_beleza: {
    tipo: "salao_beleza",
    nome: "Salão de Beleza",
    profissional: "Cabeleireiro(a)",
    profissionais: "Cabeleireiros(as)",
    servico: "Serviço",
    servicos: "Serviços",
    loginTitle: "Painel Salão",
  },
  pet_shop: {
    tipo: "pet_shop",
    nome: "Pet Shop",
    profissional: "Tosador(a)",
    profissionais: "Tosadores(as)",
    servico: "Serviço",
    servicos: "Serviços",
    loginTitle: "Painel Pet Shop",
  },
  outro: {
    tipo: "outro",
    nome: "Estabelecimento",
    profissional: "Profissional",
    profissionais: "Profissionais",
    servico: "Serviço",
    servicos: "Serviços",
    loginTitle: "Painel de Gestão",
  },
};

export const PRESETS_SERVICOS: Record<string, { nome: string; preco: number; duracao: number; categoria: string }[]> = {
  barbearia: [
    { nome: "Corte de Cabelo", preco: 40, duracao: 30, categoria: "Cabelo" },
    { nome: "Barba", preco: 30, duracao: 20, categoria: "Barba" },
    { nome: "Corte + Barba", preco: 60, duracao: 50, categoria: "Combo" },
  ],
  clinica_estetica: [
    { nome: "Limpeza de Pele", preco: 120, duracao: 60, categoria: "Facial" },
    { nome: "Drenagem Linfática", preco: 150, duracao: 50, categoria: "Corporal" },
    { nome: "Peeling", preco: 200, duracao: 45, categoria: "Facial" },
  ],
  clinica_odontologica: [
    { nome: "Limpeza (Profilaxia)", preco: 150, duracao: 40, categoria: "Geral" },
    { nome: "Consulta Inicial", preco: 100, duracao: 30, categoria: "Geral" },
    { nome: "Clareamento", preco: 600, duracao: 60, categoria: "Estética" },
  ],
  salao_beleza: [
    { nome: "Corte Feminino", preco: 80, duracao: 60, categoria: "Cabelo" },
    { nome: "Escova", preco: 50, duracao: 40, categoria: "Cabelo" },
    { nome: "Manicure", preco: 40, duracao: 45, categoria: "Unhas" },
  ],
  pet_shop: [
    { nome: "Banho e Tosa", preco: 70, duracao: 90, categoria: "Grooming" },
    { nome: "Corte de Unhas", preco: 20, duracao: 15, categoria: "Grooming" },
    { nome: "Consulta Veterinária", preco: 120, duracao: 30, categoria: "Saúde" },
  ],
};

export function getLabels(tipo: string): EstabelecimentoLabels {
  return LABELS_MAP[tipo] || LABELS_MAP.outro;
}

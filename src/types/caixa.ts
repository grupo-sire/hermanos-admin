export type CaixaStatus = "nao_aberto" | "aberto" | "fechado" | "fechado_inadvertido" | "reaberto";

export interface ResumoVendasCaixa {
  total_faturado: number;
  total_dinheiro: number;
  total_pix: number;
  total_cartao: number;
  total_planos_infinite: number;
  total_sangrias: number;
  total_reforcos: number;
  total_comandas: number;
}

export interface CaixaSessao {
  id: string;
  protocolo?: string;
  unidade_id: string;
  unidade_nome: string;
  data: string; // YYYY-MM-DD
  status: CaixaStatus;
  
  // Abertura da manhã
  aberto_em: string;
  aberto_por_email: string;
  aberto_por_nome: string;
  fundo_troco_inicial: number;
  observacao_abertura?: string;

  // Fechamento da noite
  fechado_em?: string;
  fechado_por_email?: string;
  fechado_por_nome?: string;
  saldo_esperado_gaveta?: number;
  valor_contado_gaveta?: number;
  diferenca_gaveta?: number;
  observacoes_fechamento?: string;

  // Auditoria de Virada / Não Conformidade
  incidente_nao_conformidade?: boolean;
  data_inconformidade?: string;
  auto_fechado_motivo?: string;
  detectado_virada_em?: string;

  // Reabertura excepcional
  reaberto_em?: string;
  reaberto_por_email?: string;
  reaberto_por_nome?: string;
  motivo_reabertura?: string;

  // Totais consolidados
  resumo_vendas?: ResumoVendasCaixa;
  comandas_resumo?: Array<{
    id: string;
    cliente: string;
    barbeiro: string;
    total: number;
    forma_pagamento: string;
    hora: string;
  }>;
}

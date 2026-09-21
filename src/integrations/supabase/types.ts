export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      ads_metrics: {
        Row: {
          alcance: number | null
          campanha_id_externo: string | null
          campanha_nome: string | null
          cliques: number | null
          conta_id: string | null
          conta_nome: string | null
          conversoes: number | null
          cpc: number | null
          cpm: number | null
          created_at: string
          ctr: number | null
          dados_extras: Json | null
          data_referencia: string
          empresa_id: string | null
          gasto: number | null
          id: string
          impressoes: number | null
          plataforma: string
          receita: number | null
          roas: number | null
          updated_at: string
        }
        Insert: {
          alcance?: number | null
          campanha_id_externo?: string | null
          campanha_nome?: string | null
          cliques?: number | null
          conta_id?: string | null
          conta_nome?: string | null
          conversoes?: number | null
          cpc?: number | null
          cpm?: number | null
          created_at?: string
          ctr?: number | null
          dados_extras?: Json | null
          data_referencia: string
          empresa_id?: string | null
          gasto?: number | null
          id?: string
          impressoes?: number | null
          plataforma: string
          receita?: number | null
          roas?: number | null
          updated_at?: string
        }
        Update: {
          alcance?: number | null
          campanha_id_externo?: string | null
          campanha_nome?: string | null
          cliques?: number | null
          conta_id?: string | null
          conta_nome?: string | null
          conversoes?: number | null
          cpc?: number | null
          cpm?: number | null
          created_at?: string
          ctr?: number | null
          dados_extras?: Json | null
          data_referencia?: string
          empresa_id?: string | null
          gasto?: number | null
          id?: string
          impressoes?: number | null
          plataforma?: string
          receita?: number | null
          roas?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ads_metrics_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      agenda_bloqueios: {
        Row: {
          barbeiro_id: string | null
          created_at: string
          data_fim: string
          data_inicio: string
          empresa_id: string | null
          id: string
          motivo: string | null
          tipo: string
          unidade_id: string
        }
        Insert: {
          barbeiro_id?: string | null
          created_at?: string
          data_fim: string
          data_inicio: string
          empresa_id?: string | null
          id?: string
          motivo?: string | null
          tipo: string
          unidade_id: string
        }
        Update: {
          barbeiro_id?: string | null
          created_at?: string
          data_fim?: string
          data_inicio?: string
          empresa_id?: string | null
          id?: string
          motivo?: string | null
          tipo?: string
          unidade_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "agenda_bloqueios_barbeiro_id_fkey"
            columns: ["barbeiro_id"]
            isOneToOne: false
            referencedRelation: "barbeiros"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agenda_bloqueios_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agenda_bloqueios_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          },
        ]
      }
      agendamento_servicos: {
        Row: {
          agendamento_id: string
          created_at: string
          duracao_minutos: number
          empresa_id: string | null
          id: string
          nome: string
          preco: number
          servico_id: string
        }
        Insert: {
          agendamento_id: string
          created_at?: string
          duracao_minutos: number
          empresa_id?: string | null
          id?: string
          nome: string
          preco: number
          servico_id: string
        }
        Update: {
          agendamento_id?: string
          created_at?: string
          duracao_minutos?: number
          empresa_id?: string | null
          id?: string
          nome?: string
          preco?: number
          servico_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "agendamento_servicos_agendamento_id_fkey"
            columns: ["agendamento_id"]
            isOneToOne: false
            referencedRelation: "agendamentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agendamento_servicos_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agendamento_servicos_servico_id_fkey"
            columns: ["servico_id"]
            isOneToOne: false
            referencedRelation: "servicos"
            referencedColumns: ["id"]
          },
        ]
      }
      agendamentos: {
        Row: {
          barbeiro_id: string
          cliente_id: string
          created_at: string
          data_hora: string
          duracao_minutos: number
          empresa_id: string | null
          id: string
          observacoes: string | null
          preco: number
          servico_id: string
          status: string
          unidade_id: string
          updated_at: string
        }
        Insert: {
          barbeiro_id: string
          cliente_id: string
          created_at?: string
          data_hora: string
          duracao_minutos: number
          empresa_id?: string | null
          id?: string
          observacoes?: string | null
          preco: number
          servico_id: string
          status?: string
          unidade_id: string
          updated_at?: string
        }
        Update: {
          barbeiro_id?: string
          cliente_id?: string
          created_at?: string
          data_hora?: string
          duracao_minutos?: number
          empresa_id?: string | null
          id?: string
          observacoes?: string | null
          preco?: number
          servico_id?: string
          status?: string
          unidade_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "agendamentos_barbeiro_id_fkey"
            columns: ["barbeiro_id"]
            isOneToOne: false
            referencedRelation: "barbeiros"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agendamentos_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agendamentos_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agendamentos_servico_id_fkey"
            columns: ["servico_id"]
            isOneToOne: false
            referencedRelation: "servicos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agendamentos_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          },
        ]
      }
      agentes_ia: {
        Row: {
          ativo: boolean
          created_at: string | null
          empresa_id: string
          func_agendamento: boolean
          func_fidelidade: boolean
          func_humano: boolean
          func_produtos: boolean
          id: string
          instrucoes_extras: string | null
          nome: string
          tom: string
          updated_at: string | null
          webhook_n8n_url: string | null
        }
        Insert: {
          ativo?: boolean
          created_at?: string | null
          empresa_id: string
          func_agendamento?: boolean
          func_fidelidade?: boolean
          func_humano?: boolean
          func_produtos?: boolean
          id?: string
          instrucoes_extras?: string | null
          nome?: string
          tom?: string
          updated_at?: string | null
          webhook_n8n_url?: string | null
        }
        Update: {
          ativo?: boolean
          created_at?: string | null
          empresa_id?: string
          func_agendamento?: boolean
          func_fidelidade?: boolean
          func_humano?: boolean
          func_produtos?: boolean
          id?: string
          instrucoes_extras?: string | null
          nome?: string
          tom?: string
          updated_at?: string | null
          webhook_n8n_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "agentes_ia_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: true
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      avaliacoes_barbeiros: {
        Row: {
          agendamento_id: string | null
          barbeiro_id: string
          cliente_id: string | null
          comentario: string | null
          created_at: string
          empresa_id: string
          id: string
          nota: number
          unidade_id: string | null
          updated_at: string
        }
        Insert: {
          agendamento_id?: string | null
          barbeiro_id: string
          cliente_id?: string | null
          comentario?: string | null
          created_at?: string
          empresa_id: string
          id?: string
          nota: number
          unidade_id?: string | null
          updated_at?: string
        }
        Update: {
          agendamento_id?: string | null
          barbeiro_id?: string
          cliente_id?: string | null
          comentario?: string | null
          created_at?: string
          empresa_id?: string
          id?: string
          nota?: number
          unidade_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "avaliacoes_barbeiros_barbeiro_id_fkey"
            columns: ["barbeiro_id"]
            isOneToOne: false
            referencedRelation: "barbeiros"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "avaliacoes_barbeiros_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "avaliacoes_barbeiros_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "avaliacoes_barbeiros_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          },
        ]
      }
      barbeiros: {
        Row: {
          avatar_url: string | null
          comissao_percentual: number | null
          comissao_produto: boolean | null
          comissao_servico: boolean | null
          created_at: string
          email: string
          empresa_id: string | null
          especialidade: string | null
          id: string
          nome: string
          rating: number | null
          status: string
          telefone: string | null
          total_servicos: number | null
          unidade_id: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          avatar_url?: string | null
          comissao_percentual?: number | null
          comissao_produto?: boolean | null
          comissao_servico?: boolean | null
          created_at?: string
          email: string
          empresa_id?: string | null
          especialidade?: string | null
          id?: string
          nome: string
          rating?: number | null
          status?: string
          telefone?: string | null
          total_servicos?: number | null
          unidade_id?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          avatar_url?: string | null
          comissao_percentual?: number | null
          comissao_produto?: boolean | null
          comissao_servico?: boolean | null
          created_at?: string
          email?: string
          empresa_id?: string | null
          especialidade?: string | null
          id?: string
          nome?: string
          rating?: number | null
          status?: string
          telefone?: string | null
          total_servicos?: number | null
          unidade_id?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "barbeiros_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "barbeiros_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          },
        ]
      }
      campanha_envios: {
        Row: {
          campanha_id: string
          canal: string
          cliente_id: string
          created_at: string
          empresa_id: string | null
          erro: string | null
          id: string
          mensagem: string | null
          status: string
        }
        Insert: {
          campanha_id: string
          canal?: string
          cliente_id: string
          created_at?: string
          empresa_id?: string | null
          erro?: string | null
          id?: string
          mensagem?: string | null
          status?: string
        }
        Update: {
          campanha_id?: string
          canal?: string
          cliente_id?: string
          created_at?: string
          empresa_id?: string | null
          erro?: string | null
          id?: string
          mensagem?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "campanha_envios_campanha_id_fkey"
            columns: ["campanha_id"]
            isOneToOne: false
            referencedRelation: "campanhas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campanha_envios_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campanha_envios_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      campanhas: {
        Row: {
          cashback_percentual: number | null
          created_at: string
          desconto_percentual: number | null
          dias_antecedencia: number | null
          dias_inatividade: number | null
          empresa_id: string | null
          id: string
          mensagem: string | null
          nome: string
          status: string
          tipo: string
          updated_at: string
        }
        Insert: {
          cashback_percentual?: number | null
          created_at?: string
          desconto_percentual?: number | null
          dias_antecedencia?: number | null
          dias_inatividade?: number | null
          empresa_id?: string | null
          id?: string
          mensagem?: string | null
          nome: string
          status?: string
          tipo: string
          updated_at?: string
        }
        Update: {
          cashback_percentual?: number | null
          created_at?: string
          desconto_percentual?: number | null
          dias_antecedencia?: number | null
          dias_inatividade?: number | null
          empresa_id?: string | null
          id?: string
          mensagem?: string | null
          nome?: string
          status?: string
          tipo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "campanhas_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      categorias: {
        Row: {
          created_at: string
          empresa_id: string | null
          id: string
          nome: string
          tipo: string
        }
        Insert: {
          created_at?: string
          empresa_id?: string | null
          id?: string
          nome: string
          tipo: string
        }
        Update: {
          created_at?: string
          empresa_id?: string | null
          id?: string
          nome?: string
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "categorias_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      chatbot_flows: {
        Row: {
          ativo: boolean
          created_at: string
          descricao: string | null
          empresa_id: string | null
          flow_data: Json
          id: string
          nome: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          descricao?: string | null
          empresa_id?: string | null
          flow_data?: Json
          id?: string
          nome: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          descricao?: string | null
          empresa_id?: string | null
          flow_data?: Json
          id?: string
          nome?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "chatbot_flows_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      chatbot_fluxos: {
        Row: {
          ativo: boolean
          created_at: string
          empresa_id: string | null
          gatilho: string
          id: string
          nome: string
          ordem: number
          resposta: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          empresa_id?: string | null
          gatilho: string
          id?: string
          nome: string
          ordem?: number
          resposta: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          empresa_id?: string | null
          gatilho?: string
          id?: string
          nome?: string
          ordem?: number
          resposta?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "chatbot_fluxos_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      cliente_pontos: {
        Row: {
          cliente_id: string
          created_at: string
          empresa_id: string | null
          id: string
          pontos: number
          total_acumulado: number
          total_resgatado: number
          updated_at: string
        }
        Insert: {
          cliente_id: string
          created_at?: string
          empresa_id?: string | null
          id?: string
          pontos?: number
          total_acumulado?: number
          total_resgatado?: number
          updated_at?: string
        }
        Update: {
          cliente_id?: string
          created_at?: string
          empresa_id?: string | null
          id?: string
          pontos?: number
          total_acumulado?: number
          total_resgatado?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cliente_pontos_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: true
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cliente_pontos_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      clientes: {
        Row: {
          created_at: string
          data_nascimento: string | null
          email: string | null
          empresa_id: string | null
          id: string
          nome: string
          observacoes: string | null
          telefone: string
          total_visitas: number | null
          ultima_visita: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          data_nascimento?: string | null
          email?: string | null
          empresa_id?: string | null
          id?: string
          nome: string
          observacoes?: string | null
          telefone: string
          total_visitas?: number | null
          ultima_visita?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          data_nascimento?: string | null
          email?: string | null
          empresa_id?: string | null
          id?: string
          nome?: string
          observacoes?: string | null
          telefone?: string
          total_visitas?: number | null
          ultima_visita?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "clientes_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      comanda_itens: {
        Row: {
          comanda_id: string
          created_at: string
          empresa_id: string | null
          id: string
          nome: string
          preco_unitario: number
          produto_id: string | null
          quantidade: number
          servico_id: string | null
          subtotal: number
          tipo: string
        }
        Insert: {
          comanda_id: string
          created_at?: string
          empresa_id?: string | null
          id?: string
          nome: string
          preco_unitario: number
          produto_id?: string | null
          quantidade?: number
          servico_id?: string | null
          subtotal: number
          tipo: string
        }
        Update: {
          comanda_id?: string
          created_at?: string
          empresa_id?: string | null
          id?: string
          nome?: string
          preco_unitario?: number
          produto_id?: string | null
          quantidade?: number
          servico_id?: string | null
          subtotal?: number
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "comanda_itens_comanda_id_fkey"
            columns: ["comanda_id"]
            isOneToOne: false
            referencedRelation: "comandas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comanda_itens_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comanda_itens_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "produtos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comanda_itens_servico_id_fkey"
            columns: ["servico_id"]
            isOneToOne: false
            referencedRelation: "servicos"
            referencedColumns: ["id"]
          },
        ]
      }
      comandas: {
        Row: {
          agendamento_id: string | null
          barbeiro_id: string | null
          cliente_id: string
          created_at: string
          cupom_id: string | null
          desconto: number
          empresa_id: string | null
          fechada_em: string | null
          forma_pagamento: string | null
          id: string
          observacoes: string | null
          status: string
          subtotal: number
          total: number
          unidade_id: string | null
          updated_at: string
        }
        Insert: {
          agendamento_id?: string | null
          barbeiro_id?: string | null
          cliente_id: string
          created_at?: string
          cupom_id?: string | null
          desconto?: number
          empresa_id?: string | null
          fechada_em?: string | null
          forma_pagamento?: string | null
          id?: string
          observacoes?: string | null
          status?: string
          subtotal?: number
          total?: number
          unidade_id?: string | null
          updated_at?: string
        }
        Update: {
          agendamento_id?: string | null
          barbeiro_id?: string | null
          cliente_id?: string
          created_at?: string
          cupom_id?: string | null
          desconto?: number
          empresa_id?: string | null
          fechada_em?: string | null
          forma_pagamento?: string | null
          id?: string
          observacoes?: string | null
          status?: string
          subtotal?: number
          total?: number
          unidade_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "comandas_agendamento_id_fkey"
            columns: ["agendamento_id"]
            isOneToOne: false
            referencedRelation: "agendamentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comandas_barbeiro_id_fkey"
            columns: ["barbeiro_id"]
            isOneToOne: false
            referencedRelation: "barbeiros"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comandas_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comandas_cupom_id_fkey"
            columns: ["cupom_id"]
            isOneToOne: false
            referencedRelation: "cupons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comandas_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comandas_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          },
        ]
      }
      configuracoes_plataforma: {
        Row: {
          chave: string
          descricao: string | null
          id: string
          updated_at: string | null
          valor: string | null
        }
        Insert: {
          chave: string
          descricao?: string | null
          id?: string
          updated_at?: string | null
          valor?: string | null
        }
        Update: {
          chave?: string
          descricao?: string | null
          id?: string
          updated_at?: string | null
          valor?: string | null
        }
        Relationships: []
      }
      convites: {
        Row: {
          convidado_por: string
          created_at: string
          email: string
          empresa_id: string | null
          id: string
          perfil_acesso_id: string | null
          status: string
        }
        Insert: {
          convidado_por: string
          created_at?: string
          email: string
          empresa_id?: string | null
          id?: string
          perfil_acesso_id?: string | null
          status?: string
        }
        Update: {
          convidado_por?: string
          created_at?: string
          email?: string
          empresa_id?: string | null
          id?: string
          perfil_acesso_id?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "convites_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "convites_perfil_acesso_id_fkey"
            columns: ["perfil_acesso_id"]
            isOneToOne: false
            referencedRelation: "perfis_acesso"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_funil_clientes: {
        Row: {
          cliente_id: string
          created_at: string
          empresa_id: string | null
          estagio_id: string
          id: string
          notas: string | null
          updated_at: string
          valor_estimado: number | null
        }
        Insert: {
          cliente_id: string
          created_at?: string
          empresa_id?: string | null
          estagio_id: string
          id?: string
          notas?: string | null
          updated_at?: string
          valor_estimado?: number | null
        }
        Update: {
          cliente_id?: string
          created_at?: string
          empresa_id?: string | null
          estagio_id?: string
          id?: string
          notas?: string | null
          updated_at?: string
          valor_estimado?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_funil_clientes_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: true
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_funil_clientes_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_funil_clientes_estagio_id_fkey"
            columns: ["estagio_id"]
            isOneToOne: false
            referencedRelation: "crm_funil_estagios"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_funil_estagios: {
        Row: {
          automatico: boolean
          cor: string
          created_at: string
          descricao: string | null
          empresa_id: string | null
          id: string
          nome: string
          ordem: number
        }
        Insert: {
          automatico?: boolean
          cor?: string
          created_at?: string
          descricao?: string | null
          empresa_id?: string | null
          id?: string
          nome: string
          ordem?: number
        }
        Update: {
          automatico?: boolean
          cor?: string
          created_at?: string
          descricao?: string | null
          empresa_id?: string | null
          id?: string
          nome?: string
          ordem?: number
        }
        Relationships: [
          {
            foreignKeyName: "crm_funil_estagios_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_interacoes: {
        Row: {
          cliente_id: string
          created_at: string
          data_interacao: string
          data_proxima_acao: string | null
          descricao: string | null
          empresa_id: string | null
          id: string
          proxima_acao: string | null
          responsavel_id: string | null
          status: string
          tipo: string
        }
        Insert: {
          cliente_id: string
          created_at?: string
          data_interacao?: string
          data_proxima_acao?: string | null
          descricao?: string | null
          empresa_id?: string | null
          id?: string
          proxima_acao?: string | null
          responsavel_id?: string | null
          status?: string
          tipo: string
        }
        Update: {
          cliente_id?: string
          created_at?: string
          data_interacao?: string
          data_proxima_acao?: string | null
          descricao?: string | null
          empresa_id?: string | null
          id?: string
          proxima_acao?: string | null
          responsavel_id?: string | null
          status?: string
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_interacoes_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_interacoes_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_interacoes_responsavel_id_fkey"
            columns: ["responsavel_id"]
            isOneToOne: false
            referencedRelation: "barbeiros"
            referencedColumns: ["id"]
          },
        ]
      }
      cupons: {
        Row: {
          codigo: string
          created_at: string
          data_fim: string | null
          data_inicio: string | null
          empresa_id: string | null
          id: string
          max_usos: number | null
          minimo_compra: number | null
          status: string
          tipo: string
          updated_at: string
          usos_atual: number | null
          valor: number
        }
        Insert: {
          codigo: string
          created_at?: string
          data_fim?: string | null
          data_inicio?: string | null
          empresa_id?: string | null
          id?: string
          max_usos?: number | null
          minimo_compra?: number | null
          status?: string
          tipo?: string
          updated_at?: string
          usos_atual?: number | null
          valor: number
        }
        Update: {
          codigo?: string
          created_at?: string
          data_fim?: string | null
          data_inicio?: string | null
          empresa_id?: string | null
          id?: string
          max_usos?: number | null
          minimo_compra?: number | null
          status?: string
          tipo?: string
          updated_at?: string
          usos_atual?: number | null
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "cupons_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      diagnosticos: {
        Row: {
          cliente_nome: string | null
          created_at: string
          dados: Json
          empresa_id: string
          id: string
        }
        Insert: {
          cliente_nome?: string | null
          created_at?: string
          dados?: Json
          empresa_id: string
          id?: string
        }
        Update: {
          cliente_nome?: string | null
          created_at?: string
          dados?: Json
          empresa_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "diagnosticos_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      email_config: {
        Row: {
          assunto: string
          ativo: boolean
          corpo_html: string
          created_at: string
          empresa_id: string | null
          horas_antes: number | null
          id: string
          tipo: string
          updated_at: string
        }
        Insert: {
          assunto: string
          ativo?: boolean
          corpo_html: string
          created_at?: string
          empresa_id?: string | null
          horas_antes?: number | null
          id?: string
          tipo: string
          updated_at?: string
        }
        Update: {
          assunto?: string
          ativo?: boolean
          corpo_html?: string
          created_at?: string
          empresa_id?: string | null
          horas_antes?: number | null
          id?: string
          tipo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_config_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      empresa_assinaturas: {
        Row: {
          asaas_payment_id: string | null
          asaas_subscription_id: string | null
          created_at: string
          data_inadimplencia: string | null
          data_pagamento: string | null
          data_vencimento: string | null
          dias_inadimplente: number | null
          empresa_id: string
          id: string
          status: string
          updated_at: string
          valor: number
        }
        Insert: {
          asaas_payment_id?: string | null
          asaas_subscription_id?: string | null
          created_at?: string
          data_inadimplencia?: string | null
          data_pagamento?: string | null
          data_vencimento?: string | null
          dias_inadimplente?: number | null
          empresa_id: string
          id?: string
          status?: string
          updated_at?: string
          valor?: number
        }
        Update: {
          asaas_payment_id?: string | null
          asaas_subscription_id?: string | null
          created_at?: string
          data_inadimplencia?: string | null
          data_pagamento?: string | null
          data_vencimento?: string | null
          dias_inadimplente?: number | null
          empresa_id?: string
          id?: string
          status?: string
          updated_at?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "empresa_assinaturas_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      empresa_config: {
        Row: {
          cnpj: string | null
          cor_nome: string | null
          cor_primaria: string | null
          created_at: string
          email: string | null
          endereco: string | null
          facebook: string | null
          horario_funcionamento: string | null
          id: string
          instagram: string | null
          logo_url: string | null
          nome: string
          onboarding_completo: boolean | null
          permitir_escolha_profissional: boolean | null
          telefone: string | null
          tipo_estabelecimento: string | null
          updated_at: string
          whatsapp: string | null
        }
        Insert: {
          cnpj?: string | null
          cor_nome?: string | null
          cor_primaria?: string | null
          created_at?: string
          email?: string | null
          endereco?: string | null
          facebook?: string | null
          horario_funcionamento?: string | null
          id?: string
          instagram?: string | null
          logo_url?: string | null
          nome: string
          onboarding_completo?: boolean | null
          permitir_escolha_profissional?: boolean | null
          telefone?: string | null
          tipo_estabelecimento?: string | null
          updated_at?: string
          whatsapp?: string | null
        }
        Update: {
          cnpj?: string | null
          cor_nome?: string | null
          cor_primaria?: string | null
          created_at?: string
          email?: string | null
          endereco?: string | null
          facebook?: string | null
          horario_funcionamento?: string | null
          id?: string
          instagram?: string | null
          logo_url?: string | null
          nome?: string
          onboarding_completo?: boolean | null
          permitir_escolha_profissional?: boolean | null
          telefone?: string | null
          tipo_estabelecimento?: string | null
          updated_at?: string
          whatsapp?: string | null
        }
        Relationships: []
      }
      empresas: {
        Row: {
          acesso_liberado: boolean
          asaas_customer_id: string | null
          capa_url: string | null
          cnpj: string | null
          cor_nome: string | null
          cor_primaria: string | null
          created_at: string
          email: string | null
          endereco: string | null
          facebook: string | null
          horario_funcionamento: string | null
          id: string
          instagram: string | null
          links_adicionais: Json | null
          logo_url: string | null
          multi_unidades: boolean
          nome: string
          onboarding_completo: boolean
          permitir_escolha_profissional: boolean | null
          plano_id: string | null
          slug: string | null
          status: string
          telefone: string | null
          tema_publico: string | null
          tipo_estabelecimento: string | null
          updated_at: string
          webhook_relatorios: string | null
          whatsapp: string | null
        }
        Insert: {
          acesso_liberado?: boolean
          asaas_customer_id?: string | null
          capa_url?: string | null
          cnpj?: string | null
          cor_nome?: string | null
          cor_primaria?: string | null
          created_at?: string
          email?: string | null
          endereco?: string | null
          facebook?: string | null
          horario_funcionamento?: string | null
          id?: string
          instagram?: string | null
          links_adicionais?: Json | null
          logo_url?: string | null
          multi_unidades?: boolean
          nome: string
          onboarding_completo?: boolean
          permitir_escolha_profissional?: boolean | null
          plano_id?: string | null
          slug?: string | null
          status?: string
          telefone?: string | null
          tema_publico?: string | null
          tipo_estabelecimento?: string | null
          updated_at?: string
          webhook_relatorios?: string | null
          whatsapp?: string | null
        }
        Update: {
          acesso_liberado?: boolean
          asaas_customer_id?: string | null
          capa_url?: string | null
          cnpj?: string | null
          cor_nome?: string | null
          cor_primaria?: string | null
          created_at?: string
          email?: string | null
          endereco?: string | null
          facebook?: string | null
          horario_funcionamento?: string | null
          id?: string
          instagram?: string | null
          links_adicionais?: Json | null
          logo_url?: string | null
          multi_unidades?: boolean
          nome?: string
          onboarding_completo?: boolean
          permitir_escolha_profissional?: boolean | null
          plano_id?: string | null
          slug?: string | null
          status?: string
          telefone?: string | null
          tema_publico?: string | null
          tipo_estabelecimento?: string | null
          updated_at?: string
          webhook_relatorios?: string | null
          whatsapp?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "empresas_plano_id_fkey"
            columns: ["plano_id"]
            isOneToOne: false
            referencedRelation: "planos"
            referencedColumns: ["id"]
          },
        ]
      }
      estoque_movimentacoes: {
        Row: {
          created_at: string
          empresa_id: string | null
          id: string
          observacao: string | null
          produto_id: string
          quantidade: number
          responsavel_id: string | null
          tipo: string
          unidade_id: string | null
        }
        Insert: {
          created_at?: string
          empresa_id?: string | null
          id?: string
          observacao?: string | null
          produto_id: string
          quantidade: number
          responsavel_id?: string | null
          tipo: string
          unidade_id?: string | null
        }
        Update: {
          created_at?: string
          empresa_id?: string | null
          id?: string
          observacao?: string | null
          produto_id?: string
          quantidade?: number
          responsavel_id?: string | null
          tipo?: string
          unidade_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "estoque_movimentacoes_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "estoque_movimentacoes_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "produtos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "estoque_movimentacoes_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          },
        ]
      }
      evolution_config: {
        Row: {
          api_url: string
          connected: boolean
          created_at: string
          empresa_id: string | null
          id: string
          instance_name: string
          phone_number: string | null
          qr_code: string | null
          updated_at: string
        }
        Insert: {
          api_url: string
          connected?: boolean
          created_at?: string
          empresa_id?: string | null
          id?: string
          instance_name: string
          phone_number?: string | null
          qr_code?: string | null
          updated_at?: string
        }
        Update: {
          api_url?: string
          connected?: boolean
          created_at?: string
          empresa_id?: string | null
          id?: string
          instance_name?: string
          phone_number?: string | null
          qr_code?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "evolution_config_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      horarios_feriados: {
        Row: {
          created_at: string
          data: string
          descricao: string
          empresa_id: string | null
          fechado: boolean
          horario_abertura: string | null
          horario_fechamento: string | null
          id: string
          unidade_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          data: string
          descricao: string
          empresa_id?: string | null
          fechado?: boolean
          horario_abertura?: string | null
          horario_fechamento?: string | null
          id?: string
          unidade_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          data?: string
          descricao?: string
          empresa_id?: string | null
          fechado?: boolean
          horario_abertura?: string | null
          horario_fechamento?: string | null
          id?: string
          unidade_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "horarios_feriados_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "horarios_feriados_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          },
        ]
      }
      horarios_funcionamento: {
        Row: {
          aberto: boolean
          created_at: string
          dia_semana: number
          empresa_id: string | null
          horario_abertura: string
          horario_fechamento: string
          id: string
          unidade_id: string
          updated_at: string
        }
        Insert: {
          aberto?: boolean
          created_at?: string
          dia_semana: number
          empresa_id?: string | null
          horario_abertura?: string
          horario_fechamento?: string
          id?: string
          unidade_id: string
          updated_at?: string
        }
        Update: {
          aberto?: boolean
          created_at?: string
          dia_semana?: number
          empresa_id?: string | null
          horario_abertura?: string
          horario_fechamento?: string
          id?: string
          unidade_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "horarios_funcionamento_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "horarios_funcionamento_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          },
        ]
      }
      perfil_permissoes: {
        Row: {
          created_at: string
          empresa_id: string | null
          id: string
          perfil_id: string
          permissao: string
        }
        Insert: {
          created_at?: string
          empresa_id?: string | null
          id?: string
          perfil_id: string
          permissao: string
        }
        Update: {
          created_at?: string
          empresa_id?: string | null
          id?: string
          perfil_id?: string
          permissao?: string
        }
        Relationships: [
          {
            foreignKeyName: "perfil_permissoes_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "perfil_permissoes_perfil_id_fkey"
            columns: ["perfil_id"]
            isOneToOne: false
            referencedRelation: "perfis_acesso"
            referencedColumns: ["id"]
          },
        ]
      }
      perfis_acesso: {
        Row: {
          created_at: string
          descricao: string | null
          empresa_id: string | null
          id: string
          nome: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          descricao?: string | null
          empresa_id?: string | null
          id?: string
          nome: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          descricao?: string | null
          empresa_id?: string | null
          id?: string
          nome?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "perfis_acesso_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      plano_features: {
        Row: {
          created_at: string
          feature: string
          habilitado: boolean
          id: string
          limite: number | null
          plano_id: string
        }
        Insert: {
          created_at?: string
          feature: string
          habilitado?: boolean
          id?: string
          limite?: number | null
          plano_id: string
        }
        Update: {
          created_at?: string
          feature?: string
          habilitado?: boolean
          id?: string
          limite?: number | null
          plano_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "plano_features_plano_id_fkey"
            columns: ["plano_id"]
            isOneToOne: false
            referencedRelation: "planos"
            referencedColumns: ["id"]
          },
        ]
      }
      planos: {
        Row: {
          ativo: boolean
          created_at: string
          descricao: string | null
          id: string
          nome: string
          ordem: number
          preco: number
          preco_original: number | null
          slug: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          descricao?: string | null
          id?: string
          nome: string
          ordem?: number
          preco?: number
          preco_original?: number | null
          slug: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          descricao?: string | null
          id?: string
          nome?: string
          ordem?: number
          preco?: number
          preco_original?: number | null
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      planos_fidelidade: {
        Row: {
          created_at: string
          descricao: string | null
          empresa_id: string | null
          id: string
          nome: string
          pontos_para_resgate: number
          pontos_por_real: number
          status: string
          updated_at: string
          valor_resgate: number
        }
        Insert: {
          created_at?: string
          descricao?: string | null
          empresa_id?: string | null
          id?: string
          nome: string
          pontos_para_resgate?: number
          pontos_por_real?: number
          status?: string
          updated_at?: string
          valor_resgate?: number
        }
        Update: {
          created_at?: string
          descricao?: string | null
          empresa_id?: string | null
          id?: string
          nome?: string
          pontos_para_resgate?: number
          pontos_por_real?: number
          status?: string
          updated_at?: string
          valor_resgate?: number
        }
        Relationships: [
          {
            foreignKeyName: "planos_fidelidade_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      produtos: {
        Row: {
          categoria: string | null
          created_at: string
          descricao: string | null
          empresa_id: string | null
          estoque: number
          estoque_minimo: number
          id: string
          nome: string
          preco: number
          status: string
          updated_at: string
        }
        Insert: {
          categoria?: string | null
          created_at?: string
          descricao?: string | null
          empresa_id?: string | null
          estoque?: number
          estoque_minimo?: number
          id?: string
          nome: string
          preco: number
          status?: string
          updated_at?: string
        }
        Update: {
          categoria?: string | null
          created_at?: string
          descricao?: string | null
          empresa_id?: string | null
          estoque?: number
          estoque_minimo?: number
          id?: string
          nome?: string
          preco?: number
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "produtos_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string
          id: string
          nome: string
          telefone: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email: string
          id?: string
          nome: string
          telefone?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string
          id?: string
          nome?: string
          telefone?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      servicos: {
        Row: {
          categoria: string | null
          created_at: string
          descricao: string | null
          duracao_minutos: number
          empresa_id: string | null
          id: string
          nome: string
          preco: number
          status: string
          updated_at: string
        }
        Insert: {
          categoria?: string | null
          created_at?: string
          descricao?: string | null
          duracao_minutos?: number
          empresa_id?: string | null
          id?: string
          nome: string
          preco: number
          status?: string
          updated_at?: string
        }
        Update: {
          categoria?: string | null
          created_at?: string
          descricao?: string | null
          duracao_minutos?: number
          empresa_id?: string | null
          id?: string
          nome?: string
          preco?: number
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "servicos_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      unidades: {
        Row: {
          created_at: string
          empresa_id: string | null
          endereco: string
          horario_abertura: string
          horario_fechamento: string
          horarios_semana: Json | null
          id: string
          nome: string
          status: string
          telefone: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          empresa_id?: string | null
          endereco: string
          horario_abertura?: string
          horario_fechamento?: string
          horarios_semana?: Json | null
          id?: string
          nome: string
          status?: string
          telefone?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          empresa_id?: string | null
          endereco?: string
          horario_abertura?: string
          horario_fechamento?: string
          horarios_semana?: Json | null
          id?: string
          nome?: string
          status?: string
          telefone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "unidades_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          empresa_id: string | null
          id: string
          perfil_acesso_id: string | null
          role: Database["public"]["Enums"]["app_role"]
          unidade_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          empresa_id?: string | null
          id?: string
          perfil_acesso_id?: string | null
          role: Database["public"]["Enums"]["app_role"]
          unidade_id?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          empresa_id?: string | null
          id?: string
          perfil_acesso_id?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          unidade_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_roles_perfil_acesso_id_fkey"
            columns: ["perfil_acesso_id"]
            isOneToOne: false
            referencedRelation: "perfis_acesso"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_roles_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_conversas: {
        Row: {
          atendimento_humano: boolean
          booking_state: Json | null
          cliente_id: string | null
          created_at: string
          empresa_id: string | null
          estagio_funil_id: string | null
          flow_state: Json | null
          id: string
          nao_lidas: number
          nome_contato: string | null
          status: string
          telefone: string
          ultima_mensagem: string | null
          ultima_mensagem_at: string | null
          updated_at: string
        }
        Insert: {
          atendimento_humano?: boolean
          booking_state?: Json | null
          cliente_id?: string | null
          created_at?: string
          empresa_id?: string | null
          estagio_funil_id?: string | null
          flow_state?: Json | null
          id?: string
          nao_lidas?: number
          nome_contato?: string | null
          status?: string
          telefone: string
          ultima_mensagem?: string | null
          ultima_mensagem_at?: string | null
          updated_at?: string
        }
        Update: {
          atendimento_humano?: boolean
          booking_state?: Json | null
          cliente_id?: string | null
          created_at?: string
          empresa_id?: string | null
          estagio_funil_id?: string | null
          flow_state?: Json | null
          id?: string
          nao_lidas?: number
          nome_contato?: string | null
          status?: string
          telefone?: string
          ultima_mensagem?: string | null
          ultima_mensagem_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_conversas_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_conversas_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_conversas_estagio_funil_id_fkey"
            columns: ["estagio_funil_id"]
            isOneToOne: false
            referencedRelation: "crm_funil_estagios"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_mensagens: {
        Row: {
          cliente_id: string | null
          created_at: string
          direcao: string
          empresa_id: string | null
          id: string
          lida: boolean
          mensagem: string
          telefone: string
          tipo: string
        }
        Insert: {
          cliente_id?: string | null
          created_at?: string
          direcao?: string
          empresa_id?: string | null
          id?: string
          lida?: boolean
          mensagem: string
          telefone: string
          tipo?: string
        }
        Update: {
          cliente_id?: string | null
          created_at?: string
          direcao?: string
          empresa_id?: string | null
          id?: string
          lida?: boolean
          mensagem?: string
          telefone?: string
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_mensagens_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_mensagens_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      empresa_has_feature: {
        Args: { _empresa_id: string; _feature: string }
        Returns: boolean
      }
      get_user_empresa_id: { Args: { _user_id: string }; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_super_admin: { Args: { _user_id: string }; Returns: boolean }
      link_user_by_email: { Args: never; Returns: string }
      user_has_permission: {
        Args: { _permissao: string; _user_id: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "manager" | "barber" | "super_admin"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "manager", "barber", "super_admin"],
    },
  },
} as const

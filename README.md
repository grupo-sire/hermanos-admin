# 💈 Barbearia Hermanos — ERP & Sistema de Gestão Multi-Unidades

Sistema integrado de gestão corporativa, agendamentos, checkout/comandas, controle de estoque centralizado e transferência de suprimentos para as filiais da **Barbearia Hermanos**.

---

## 🚀 Tecnologias Utilizadas

- **Frontend**: React 18 + Vite + TypeScript + TailwindCSS + Shadcn UI.
- **Backend / Banco de Dados**: Supabase (Postgres, Auth, RLS e Edge Functions em Deno).
- **Gerenciamento de Estado & Cache**: TanStack React Query + Context API.
- **Ícones & UI**: Lucide React + Recharts (Gráficos corporativos).

---

## 🏛️ Arquitetura do Sistema

O sistema é dividido em dois níveis principais de acesso:

### 1. 👑 SuperAdmin (Matriz / Diretoria Executiva) — Rota `/admin`
- **Catálogo Mestre**: O SuperAdmin é o único com permissão para criar, editar ou excluir **Produtos**, **Serviços** e **Categorias** globais.
- **Painel Mestre**: Visão 360° consolidada com faturamento global (soma de todas as 7 filiais), total de atendimentos e alertas de baixo estoque.
- **Central de Suprimentos (Estoque Central)**:
  - Recebe os pedidos de reposição vindos das filiais.
  - Ao despachar a encomenda, **dá baixa automática no Estoque Central da Matriz** e coloca o pedido com status `em_transito`.
  - **Auditoria de Divergências**: Analisa discrepâncias entre o que a Matriz despachou e o que a Filial efetivamente recebeu no destino.

### 2. 🏪 Painel da Filial (Operacional / Gerência) — Rota `/:slug`
- **Operação Local**: Agendamentos, comandas, barbeiros, checkout e caixa da unidade.
- **Estoque Local & Suprimentos**:
  - Consulta o catálogo mestre de produtos e serviços em modo leitura.
  - Botão **"Pedir à Matriz"**: Envia solicitações de suprimento para a central da Hermanos.
  - Botão **"Conferir Recebimento"**: Ao receber a caixa da Matriz, a filial confere item por item. Se houver falta ou avaria, grava a contestação com motivo e dá entrada no estoque local **apenas do que realmente chegou**.

---

## 🔒 Segurança e Permissões (RLS & Roles)

A segurança do sistema é garantida via **Row Level Security (RLS)** no Postgres do Supabase.

### Papéis de Usuário (`user_roles`)
- `super_admin`: Acesso irrestrito a todas as unidades, gestão do catálogo mestre e painel `/admin`.
- `admin`: Gerente geral da empresa.
- `manager`: Gerente/supervisor de unidade específica (`unidade_id`).
- `barber`: Profissional barbeiro (vê apenas sua própria agenda e atendimentos).

---

## 📦 Módulo de Suprimentos & Transferências

```
[Filial Solicita] ➔ Status: 'pendente'
      │
[Matriz Despacha] ➔ Baixa no Estoque Central ➔ Status: 'em_transito'
      │
[Filial Confere] ➔ Dá entrada no Estoque Local
      ├── Se 100% OK ➔ Status: 'entregue_concluido'
      └── Se houver divergência ➔ Status: 'divergencia_pendente' (Notifica Matriz para Auditoria)
```

---

## 🛠️ Configuração do Ambiente Local

### 1. Requisitos
- Node.js 18+ ou 20+
- Conta no Supabase

### 2. Variáveis de Ambiente (`.env`)
Crie um arquivo `.env` na raiz do projeto com as chaves do Supabase:

```env
VITE_SUPABASE_URL="https://sua-url.supabase.co"
VITE_SUPABASE_ANON_KEY="sua-anon-key-publica"
SUPABASE_SERVICE_ROLE_KEY="sua-service-role-key-privada"
```

### 3. Rodar o Projeto
```bash
# Instalar dependências
npm install

# Rodar servidor de desenvolvimento
npm run dev
```

---

## 📋 Checklist para Produção (Hostinger)

1. Build estático gerado via `npm run build` na pasta `dist/`.
2. Arquivo `.htaccess` configurado na raiz do servidor web Apache da Hostinger para redirecionar rotas SPA para o `index.html`.
3. Variáveis de ambiente configuradas no Supabase Cloud (Edge Functions).

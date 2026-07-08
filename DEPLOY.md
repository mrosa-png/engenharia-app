# Guia de Deploy — App Ordens de Serviço Guandu

## Pré-requisitos
- Conta no [Supabase](https://supabase.com) (gratuita)
- Conta no [Vercel](https://vercel.com) (gratuita)
- Conta no [GitHub](https://github.com) (gratuita)
- Node.js 18+ instalado localmente

---

## PASSO 1 — Configurar o Supabase

1. Acesse [supabase.com](https://supabase.com) e crie um novo projeto
2. Aguarde o banco inicializar (~2 min)
3. Vá em **SQL Editor** e cole todo o conteúdo de `supabase/schema.sql`
4. Clique em **Run** para criar as tabelas e políticas
5. Vá em **Storage** → **New Bucket**:
   - Nome: `os-photos`
   - Marque como **Public**
   - Clique em **Create**
6. Vá em **Project Settings** → **API** e copie:
   - `Project URL` → será `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public` → será `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role secret` → será `SUPABASE_SERVICE_ROLE_KEY`

---

## PASSO 2 — Criar o primeiro Super Admin

1. No Supabase, vá em **Authentication** → **Users** → **Add User**
2. Informe e-mail e senha do administrador principal
3. Copie o UUID gerado
4. Vá em **SQL Editor** e execute:
```sql
INSERT INTO profiles (id, full_name, role, unit_id)
VALUES ('<UUID_COPIADO>', 'Nome do Admin', 'super_admin', NULL);
```

---

## PASSO 3 — Subir o código no GitHub

```bash
# Na pasta do projeto:
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/SEU_USUARIO/guandu-app.git
git push -u origin main
```

---

## PASSO 4 — Deploy no Vercel

1. Acesse [vercel.com](https://vercel.com) e clique em **Add New Project**
2. Importe o repositório do GitHub
3. Na tela de configuração, adicione as variáveis de ambiente:

| Variável | Valor |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | URL do seu projeto Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Chave anon do Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | Chave service_role do Supabase |

4. Clique em **Deploy**
5. Aguarde ~2 minutos — seu app estará disponível em `https://guandu-app.vercel.app` (ou similar)

---

## PASSO 5 — Configurar usuários e funcionários

1. Acesse o app com o e-mail e senha do Super Admin
2. Vá em **Administração** → aba **Funcionários**:
   - Adicione todos os colaboradores da unidade Guandu
3. Aba **Usuários do Sistema**:
   - Crie os usuários dos encarregados (perfil: Encarregado + Unidade: GUANDU)
   - Crie usuários de gestores se necessário
4. Compartilhe o link e as credenciais com cada encarregado

---

## Estrutura de Perfis

| Perfil | O que pode fazer |
|---|---|
| **Encarregado** | Preencher formulário de OS |
| **Gestor** | Ver dashboard e relatórios |
| **Super Admin** | Tudo acima + gerenciar usuários, funcionários e unidades |

---

## Desenvolvimento local

```bash
# Instalar dependências
npm install

# Criar arquivo de variáveis
cp .env.example .env.local
# Edite .env.local com suas chaves do Supabase

# Rodar localmente
npm run dev
# Acesse http://localhost:3000
```

---

## Suporte
Em caso de dúvidas sobre o deploy, consulte:
- [Documentação Next.js no Vercel](https://vercel.com/docs/frameworks/nextjs)
- [Documentação Supabase](https://supabase.com/docs)

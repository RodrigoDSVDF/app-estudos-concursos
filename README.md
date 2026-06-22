# ConcursoTrack — Organizador de Estudos para Concursos

Aplicativo web (HTML5 + CSS3 + JavaScript puro) para gerenciamento e otimização de estudos para concursos públicos. Funciona diretamente no **GitHub Pages** com **login Google** e **Supabase** como backend. Cada usuário tem seus dados isolados.

> 📊 **Stack**:
> - **Frontend**: HTML5 + CSS3 + JavaScript vanilla (sem build)
> - **Backend**: Supabase (PostgreSQL + Storage + Auth com Google)
> - **Bibliotecas CDN**: Supabase JS, Chart.js, SheetJS, jsPDF
> - **Multi-usuário**: cada conta Google vê apenas seus próprios dados

---

## 🚀 Setup completo (6 passos)

### Passo 1 — Criar credenciais Google OAuth

1. Acesse https://console.cloud.google.com/
2. Crie um projeto (ou use um existente)
3. Vá em **APIs & Services → OAuth consent screen**
   - User type: **External**
   - Preencha nome do app, email de suporte
   - Adicione o escopo `userinfo.email` e `userinfo.profile`
   - Adicione seu email como "Test user" (enquanto o app não for verificado)
4. Vá em **APIs & Services → Credentials → Create Credentials → OAuth client ID**
   - Application type: **Web application**
   - Authorized JavaScript origins:
     ```
     https://zryovbcyhecxwduzdpme.supabase.co
     http://localhost
     http://localhost:8000
     https://<seu-usuario>.github.io
     ```
   - Authorized redirect URIs:
     ```
     https://zryovbcyhecxwduzdpme.supabase.co/auth/v1/callback
     ```
   - **Anotue o Client ID e o Client Secret**

### Passo 2 — Ativar Google no Supabase

1. Acesse: https://supabase.com/dashboard/project/zryovbcyhecxwduzdpme/auth/providers
2. Clique em **Google**
3. Ative o toggle "Enable Sign-In with Google"
4. Cole o **Client ID** e o **Client Secret** do passo 1
5. Em "Redirect URL" já vai aparecer `https://zryovbcyhecxwduzdpme.supabase.co/auth/v1/callback` — copie esta URL
6. Volte no Google Cloud Console e confirme que essa URL está em "Authorized redirect URIs"
7. **Save** no Supabase

### Passo 3 — Configurar URL de redirect no Supabase

1. Acesse: https://supabase.com/dashboard/project/zryovbcyhecxwduzdpme/auth/url-configuration
2. Em **Site URL**, coloque a URL do seu GitHub Pages:
   ```
   https://<seu-usuario>.github.io/<nome-do-repositorio>/
   ```
3. Em **Redirect URLs**, adicione:
   ```
   http://localhost:8000
   https://<seu-usuario>.github.io/<nome-do-repositorio>/
   ```
4. **Save**

### Passo 4 — Executar o schema SQL

1. Acesse: https://supabase.com/dashboard/project/zryovbcyhecxwduzdpme/sql/new
2. Abra o arquivo `supabase-schema.sql`, copie TODO o conteúdo e cole no editor
3. Clique em **RUN** (Ctrl+Enter)
4. Deve aparecer "Success. No rows returned"

> ⚠️ Este script **apaga tabelas antigas** e cria tudo do zero. Faça backup antes se necessário.

### Passo 5 — Verificar credenciais do app

Abra `js/supabase-client.js` e confirme:

```js
const SUPABASE_URL = 'https://zryovbcyhecxwduzdpme.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_VuRMIQ05oRXm4THTxAkZQQ_MK2qDV01';
```

(Credenciais já configuradas com as que você forneceu.)

### Passo 6 — Teste local e deploy

```bash
# Teste local
cd concursos-app
python3 -m http.server 8000
# Acesse http://localhost:8000 — deve mostrar tela de login com botão Google
```

Para GitHub Pages:
1. Crie um repositório no GitHub
2. Faça upload de todos os arquivos
3. **Settings → Pages → Source: `main` branch / root → Save**
4. Aguarde 1–2 minutos
5. Acesse: `https://<seu-usuario>.github.io/<nome-do-repositorio>/`

---

## 🔐 Como funciona o login

1. Usuário acessa a URL → vê tela de login elegante (não vê o app)
2. Clica em **"Entrar com Google"** → redireciona para OAuth do Google
3. Google pede consentimento → redireciona de volta com sessão
4. App detecta sessão → libera acesso ao dashboard
5. Dados ficam isolados por `auth.uid()` (RLS): cada usuário vê só os seus
6. Avatar + nome do usuário aparecem no sidebar; botão 🚪 para logout

### Isolamento de dados
- Todas as tabelas têm coluna `user_id uuid references auth.users(id)`
- RLS policy: `using (auth.uid() = user_id) with check (auth.uid() = user_id)`
- Trigger `set_user_id()` preenche `user_id` automaticamente em INSERT
- Storage bucket `editais` isola por pasta `<user_id>/...`

---

## 🛠️ Troubleshooting

### 1. Tela de login aparece, mas clicar em Google não faz nada
- Verifique se o provedor Google está ativado em **Authentication → Providers → Google**.
- Confirme que Client ID e Client Secret foram colados corretamente.
- Veja o erro no Console (F12) e no Supabase Dashboard → Authentication → Logs.

### 2. Erro: "redirect_uri_mismatch" no Google
- A URL `https://zryovbcyhecxwduzdpme.supabase.co/auth/v1/callback` precisa estar em **Authorized redirect URIs** no Google Console.

### 3. Após login, erro "Conexão com Supabase falhou"
- Schema SQL não foi executado. Veja o Passo 4 acima.

### 4. Erro: "Could not find the table 'public.concursos' in the schema cache"
- Execute o `supabase-schema.sql` no SQL Editor do Supabase.

### 5. Login funcionava e parou de funcionar
- Verifique se a sessão expirou (Auth → Users no Supabase).
- Tente limpar cookies/localStorage (F12 → Application → Storage → Clear site data).
- Clique em 🚪 no sidebar para sair e logar novamente.

### 6. Erro "fetch failed" ou app não carrega
- Verifique sua internet.
- Confirme que o Supabase está online: https://status.supabase.com

### 7. Não consigo anexar edital PDF
- Verifique se o bucket `editais` existe em **Storage** do Supabase (o script cria).
- Para produção, considere tornar o bucket privado e usar signed URLs.

### 8. Usuário vê dados que não são seus
- Impossível com este schema: RLS bloqueia via `auth.uid() = user_id`.
- Se acontecer, verifique se as policies foram criadas (execute `select * from pg_policies`).

### 9. Quero adicionar mais provedores (GitHub, Microsoft, etc.)
- Em Authentication → Providers, ative o provedor desejado.
- O método `Auth.signInWithGoogle()` pode ser adaptado para outros provedores (mude `provider: 'github'` por exemplo).

---



## ✨ Funcionalidades

### 1. Cadastro de Concursos
- Nome, órgão, banca organizadora, data prevista, link do edital.
- Upload do edital em **PDF** (enviado ao Supabase Storage; URL pública gerada automaticamente).
- Status: Planejado / Em andamento / Finalizado.

### 2. Cadastro de Matérias
- Vinculadas a cada concurso.
- Peso na prova, prioridade (1-5), carga horária planejada.
- Cálculo automático do percentual de conclusão.

### 3. Cadastro de Conteúdos
- Vinculados a cada matéria.
- Status: Não iniciado / Em andamento / Concluído.
- Nível de dificuldade percebido (1-5).
- Ao marcar como concluído, **revisões espaçadas são geradas automaticamente**.

### 4. Registro de Sessões de Estudo
- Data, hora início, hora fim, tempo total (calculado automaticamente).
- Vinculação com concurso, matéria e conteúdo.
- Tipo de estudo: Teoria / Exercícios / Revisão / Simulado.
- Técnica: Pomodoro / Leitura ativa / Flashcards / Resolução de questões / Livre.
- Avaliações de 1 a 5: concentração, energia, compreensão, humor antes e depois.
- **Cronômetro integrado** com start / pause / stop.

### 5. Bloco de Anotações
- Campos: resumo, dúvidas, principais aprendizados, erros recorrentes, próximos passos.
- **Tags** para organização.
- **Busca por palavra-chave** em todos os campos.
- Edição posterior ilimitada.

### 6. Sistema de Revisões Espaçadas
- Geração automática ao concluir um conteúdo: **D+1, D+7, D+15, D+30**.
- Marcar como concluída.
- Reagendar com um clique.
- **Badge na barra lateral** com revisões atrasadas.

### 7. Dashboard Analítico
Estatísticas e gráficos interativos (Chart.js):
- Total de horas estudadas.
- Sequência de dias (streak).
- Conteúdos concluídos / pendentes / taxa de conclusão.
- Média de concentração e compreensão.
- **Gráficos**:
  - Horas estudadas nos últimos 14 dias (barras).
  - Horas por matéria (rosca).
  - Horas por tipo de estudo (pizza).
  - Produtividade por horário do dia (barras + linha).
  - Evolução semanal (linha com área).
  - Correlação concentração × compreensão (scatter).
  - Progresso por concurso (barras horizontais).
  - Média de concentração por matéria (barras).

### 8. Insights Inteligentes
Análise automática que gera recomendações como:
- "Seu melhor desempenho ocorre entre 6h e 8h."
- "Você apresenta maior concentração ao estudar Matemática."
- "Seu rendimento cai após 90 minutos contínuos."
- "Você possui revisões atrasadas em Direito Administrativo."
- "Conteúdos com baixa compreensão exigem mais exercícios."
- "Estudo melhora seu humor" (análise humor antes vs depois).
- "Aumento de produtividade" (comparação semanal).

### 9. Busca e Filtros
- **Filtro global de concurso** no topo (aplica-se a todo o app).
- Filtros por matéria, conteúdo, período, tipo de estudo, nível de concentração.
- Busca textual nas anotações.

### 10. Backup e Exportação
- **JSON**: backup completo (todos os dados + editais em PDF).
- **CSV**: sessões de estudo (compatível com Excel / Google Sheets).
- **XLSX**: workbook com múltiplas abas (Concursos, Matérias, Conteúdos, Sessões, Revisões).
- **PDF**: relatório consolidado com resumo, progresso por concurso e revisões pendentes.
- **Importação** de backup JSON (substitui dados atuais).

---

## 🎨 Interface

- Design **limpo e minimalista**.
- **Tema claro e escuro** (alternável, persistente via `localStorage`).
- Totalmente **responsivo** (desktop, tablet, mobile).
- Sidebar de navegação colapsável em mobile.
- Indicadores visuais de progresso (barras e badges coloridos).
- Cores acessíveis (contraste WCAG AA).

---

## 🗂️ Estrutura do Projeto

```
concursos-app/
├── index.html              # Página única (SPA)
├── css/
│   └── style.css           # Estilos com temas claro/escuro
├── js/
│   ├── app.js              # Controlador principal (rotas, tema, init)
│   ├── supabase-client.js  # Configuração do cliente Supabase (URL + chave)
│   ├── db.js               # Camada de persistência (Supabase) + Service
│   ├── utils.js            # Funções utilitárias (datas, formatação, toasts, modal)
│   ├── seed.js             # Dados de exemplo (carregados na 1ª execução)
│   ├── concursos.js        # CRUD de concursos
│   ├── materias.js         # CRUD de matérias
│   ├── conteudos.js        # CRUD de conteúdos
│   ├── sessoes.js          # Sessões + Cronômetro integrado
│   ├── anotacoes.js        # Bloco de anotações + busca + tags
│   ├── revisoes.js         # Sistema de revisão espaçada
│   ├── dashboard.js        # Dashboard analítico com Chart.js
│   ├── insights.js         # Geração automática de insights
│   └── backup.js           # Exportação/importação (JSON, CSV, XLSX, PDF)
├── assets/                 # (reservado para imagens/ícones futuros)
├── data/                   # (reservado para dados estáticos)
└── README.md
```

---

## 🏗️ Arquitetura

### Padrão MVC simplificado
- **Models**: objetos JS puros (sem framework) com schema relacional implicitamente definido em `db.js`.
- **Views**: um módulo por feature (`ConcursosView`, `MateriasView`, etc.). Cada view expõe `render(container)` que injeta HTML no container principal.
- **Controller**: `App` (em `app.js`) faz roteamento, gerência de tema e filtro global.
- **Service**: camada de negócio em `db.js` (objeto `Service`) que encapsula regras como cascata de exclusão, geração de revisões e cálculos.

### Persistência: Supabase (PostgreSQL + Storage)
- **PostgreSQL real** com chaves estrangeiras, índices, triggers e cascade nativo.
- Schema com 8 tabelas: `concursos`, `materias`, `conteudos`, `sessoes`, `anotacoes`, `revisoes`, `editais`, `meta`.
- **RLS habilitado** com políticas permissivas para a anon key (MVP sem auth — para multi-usuário, habilite Auth e troque as policies).
- **Storage bucket** `editais` para armazenar PDFs de editais com URL pública.
- Trigger `update_atualizado_em` atualiza `atualizado_em` automaticamente em UPDATE.
- **Dados na nuvem**: acessíveis de qualquer dispositivo que acessar a mesma URL do app.

### Bibliotecas externas (todas via CDN, sem instalação)
- **Supabase JS 2.45.4** — cliente PostgreSQL/Storage/Auth.
- **Chart.js 4.4.1** — gráficos interativos.
- **SheetJS (xlsx) 0.18.5** — exportação para Excel.
- **jsPDF 2.5.1** + **jspdf-autotable 3.8.2** — geração de PDF.

Nenhuma instalação de `npm`/`yarn` é necessária.

---

## 🧪 Teste local

### Opção A — Abrir direto no navegador
```bash
# Linux/Mac
open concursos-app/index.html

# Windows
start concursos-app/index.html
```
Funciona para a maioria das features. Algumas restrições de `file://` podem afetar o carregamento de bibliotecas via CDN dependendo do navegador.

### Opção B — Servidor HTTP simples (recomendado)
```bash
# Python 3
cd concursos-app
python3 -m http.server 8000
# Acesse: http://localhost:8000

# OU Node.js (sem dependências)
cd concursos-app
npx serve .
```

---

## 📊 Modelo de Dados (relacional)

```
concursos (1) ─── (N) materias (1) ─── (N) conteudos
   │                    │                    │
   │                    │                    └── (1) ─── (N) revisoes
   │                    │
   │ (1) ─── (N) sessoes (N) ─── (1) ─── (1) anotacoes
   │
   └── (1) ─── (N) editais [Blob PDF]
```

Cada tabela tem `id` (UUID v4) como chave primária. Chaves estrangeiras têm `ON DELETE CASCADE` ou `SET NULL` conforme apropriado. O schema SQL completo está em `supabase-schema.sql`.

---

## 🔒 Privacidade e Segurança

- **Dados no Supabase**: todos os dados (concursos, sessões, anotações, etc.) ficam no PostgreSQL do seu projeto Supabase.
- **PDFs no Storage**: arquivos de editais ficam no bucket público `editais` do Supabase Storage.
- **Anon key**: a chave usada no front-end é a `anon` (pública). As políticas RLS garantem que apenas operações permitidas sejam executadas.
- **MVP sem auth**: as políticas RLS atuais permitem acesso total via anon key. **Para uso compartilhado/multi-usuário, habilite Supabase Auth e troque as policies** para usar `auth.uid()` (já há um esboço nos comentários do script SQL).
- **Requisições externas**: além do Supabase, o app só acessa CDNs (jsDelivr) para carregar bibliotecas.

---

## 🛣️ Roadmap futuro (preparado para)

- **Autenticação multi-usuário** com Supabase Auth (já suportado pelo schema — basta ativar).
- **Realtime**: subscrição Supabase Realtime para atualizar dados em tempo real entre dispositivos.
- **Integração com IA** para geração de plano de estudos personalizado.
- **PWA** com Service Worker para uso offline (com sync quando voltar online).
- **Importação de editais** com extração automática de conteúdo (OCR via Tesseract.js).

A arquitetura modular facilita a adição dessas features — a separação entre `Service` (lógica de negócio) e `Views` (UI) permite evoluir o backend sem reescrever a interface.

---

## 📝 Licença

MIT — use livremente para seus estudos. Boa sorte nos concursos! 🎯

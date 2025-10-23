# Zé Ramalho CMS

Painel administrativo completo desenvolvido com Next.js 14, NextAuth.js 5, MongoDB e Cloudinary para gerenciar o conteúdo migrado do Strapi legado.

## ✨ Principais recursos

- Autenticação com NextAuth (register, login, recuperação e redefinição de senha)
- CRUD completo para livros, CDs (com gerenciamento de faixas), DVDs (com letras) e clips
- Upload de imagens direto para o Cloudinary com reutilização e limpeza automática
- Painel administrativo responsivo com Tailwind CSS e componentes Shadcn/UI
- Dashboard com métricas de publicações, faixas e uso de mídia
- API REST protegida por middleware com validações Zod e modelos Mongoose

## 📦 Requisitos

- Node.js 18+
- Conta no MongoDB Atlas
- Conta no Cloudinary
- (Opcional) SMTP compatível para envio de email de recuperação de senha

## 🚀 Como executar localmente

1. Instale as dependências:

   ```bash
   npm install
   ```

2. Copie as variáveis de ambiente:

   ```bash
   cp .env.example .env.local
   ```

3. Preencha o arquivo `.env.local` com suas credenciais de MongoDB, Cloudinary, NextAuth e SMTP (se desejar recuperação de senha por email).

4. Execute a aplicação em modo desenvolvimento:

   ```bash
   npm run dev
   ```

5. Acesse [http://localhost:3000](http://localhost:3000).

## 🔐 Criando o primeiro administrador

1. Com a aplicação rodando, acesse `/auth/register`.
2. Cadastre nome, email e senha. O e-mail precisa ser único na base.
3. Após a criação, faça login em `/auth/login` e você será redirecionado para `/admin`.

## 🗂️ Estrutura do projeto

```
app/
  auth/            // telas de autenticação
  admin/           // dashboard e CRUDs protegidos
  api/             // rotas REST (Next.js Route Handlers)
components/
  admin/           // componentes do painel
  ui/              // componentes base (Shadcn)
lib/
  models/          // schemas Mongoose
  validations/     // esquemas Zod
  auth.ts          // configuração NextAuth
  mongodb.ts       // conexão com MongoDB
  cloudinary.ts    // SDK Cloudinary configurado
middleware.ts       // proteção de rotas /admin
```

## 📁 Coleções suportadas

- **Livros**: título, autor, editora, data, ISBN, resumo, capa, publicação
- **CDs**: título, gravadora, data, informação, capa e faixas (nome, compositores)
- **DVDs**: título, produtora, data, informação, URL do Vimeo e faixas (nome, compositores, duração, letra)
- **Clips**: título, descrição, URL do YouTube e galeria de imagens
- **Uploads**: metadados das imagens enviadas ao Cloudinary
- **Admins**: usuários autenticados do painel

## 🧪 Validações e segurança

- Zod valida todos os payloads de entrada
- Slugs gerados automaticamente a partir dos títulos
- Objetos `ObjectId` validados antes de operações de banco
- Rotas `/api` e `/admin` protegidas por sessão JWT via NextAuth
- Uploads checados por tipo e tamanho (máx. 10MB, imagens PNG/JPEG/WebP)

## 📤 Deploy na Vercel

1. Configure o projeto na Vercel apontando para este repositório.
2. Defina as variáveis de ambiente no painel da Vercel (mesmas do `.env.local`).
3. Build command: `npm run build`
4. Output: `.next`
5. Após o deploy, ajuste `NEXTAUTH_URL` para o domínio de produção.

## 🗒️ Notas

- O dashboard exibe estatísticas agregadas de publicações e faixas.
- Remoção de registros atualiza os relacionamentos no banco e limpa a mídia órfã do Cloudinary.
- Estrutura pensada para expansão: novos content types podem ser criados replicando os modelos e rotas existentes.

## 📄 Licença

Projeto interno de migração. Utilize conforme as necessidades do time.

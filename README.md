# Controla Marcher

Aplicação de controle de portaria da Marcher, com foco em operação diária de entrada e saída, cadastros de apoio, entregas, ramais e gestão de usuários.

O projeto roda em Vite no front-end e usa Supabase como backend principal. Também existe fallback em `localStorage` para desenvolvimento e contingência.

## O que a aplicação faz

- Controle de entrada e saída de pessoas, motoristas, visitantes e prestadores.
- Cadastros de visitantes, motoristas, veículos e lista de ramais.
- Gestão de entregas e produtos.
- Controle de perfis de acesso: `Super Admin`, `Admin`, `Segurança` e `Consulta`.
- Login com Supabase Auth.
- Recuperação de senha pela tela de login.
- Gestão de usuários no painel administrativo.
- Definição direta de nova senha pelo Admin/Super Admin no painel de usuários.
- Upload de foto por arquivo e captura por webcam nos cadastros compatíveis.

## Stack e estrutura

- Front-end: `Vite` + JavaScript modular
- Backend: `Supabase`
- Auth: `Supabase Auth`
- Banco: `Postgres / Supabase`
- Storage de fotos: `Supabase Storage`

Arquivos principais:

```text
index.html                         shell principal, overlay de login e recuperação
src/
  main.js                          bootstrap da aplicação
  app.js                           UI, fluxos de tela e regras do front-end
  auth.js                          login, recuperação, perfil e gestão de usuários
  styles.css                       estilos da aplicação
  config.js                        configuração do backend
  data/
    client.js                      cliente Supabase
    repo.js                        seleção do adapter ativo
    supabase.js                    adapter Supabase
    local.js                       adapter localStorage
    storage.js                     upload e remoção de fotos
sql/
  schema.sql                       schema principal + RLS + triggers
  seed_ramais.sql                  carga inicial de ramais
  storage_photos.sql               bucket e policies das fotos
  validation_queries.sql           consultas de validação
supabase/functions/
  invite-user/                     convite de novo usuário por e-mail
  manage-user/                     ações administrativas de usuário
```

## Como rodar localmente

```bash
npm install
npm run dev
```

Scripts disponíveis:

```bash
npm run dev
npm run build
npm run preview
```

## Configuração do backend

Hoje a configuração está centralizada em [src/config.js](C:/Users/rguimaraes/OneDrive%20-%20MARCHER%20BRASIL%20AGROINDUSTRIAL%20SA/%C3%81rea%20de%20Trabalho/controla-marcher/src/config.js), com:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_PHOTOS_BUCKET`

Se `SUPABASE_URL` e `SUPABASE_ANON_KEY` estiverem preenchidos, o app usa Supabase.
Se não estiverem, cai no modo `localStorage`.

Observação importante:

- A chave pública `sb_publishable_...` pode ficar no client.
- A chave secreta `sb_secret_...` nunca deve ser exposta no front-end.
- A proteção de dados depende das policies de `RLS`.

## Setup do Supabase

1. Criar o projeto no Supabase.
2. Rodar `sql/schema.sql` no SQL Editor.
3. Rodar `sql/seed_ramais.sql`.
4. Rodar `sql/storage_photos.sql` para habilitar o bucket de fotos.
5. Criar ou convidar os usuários.
6. Garantir que as policies e triggers do schema tenham sido aplicadas corretamente.

Exemplo para promover o primeiro administrador:

```sql
update public.profiles
set perfil = 'Administrador'
where id = (
  select id
  from auth.users
  where email = 'voce@marcher.com.br'
);
```

## Fluxos de usuários

### Convite de novo usuário

Para o fluxo de convite funcionar:

1. Fazer o deploy da Edge Function `invite-user`.
2. Configurar o secret `INVITE_REDIRECT_TO` com a URL pública do app.
3. Conferir se o template de convite do Supabase Auth está ativo.

Depois disso, o Admin pode cadastrar o usuário informando e-mail e perfil no painel de usuários.

### Gestão administrativa de usuários

A Edge Function `manage-user` hoje concentra ações administrativas como:

- envio de redefinição de senha
- definição direta de nova senha
- outras ações administrativas associadas ao painel de usuários

O front-end já usa esse endpoint para a ação de definir nova senha pelo painel.

### Recuperação de senha pela tela de login

O botão `Esqueci minha senha` envia o e-mail de recuperação via Supabase Auth.

Quando o usuário abre o link recebido:

- o sistema deve abrir a etapa de definição da nova senha
- o fluxo de recuperação deve acontecer antes da entrada normal no sistema

Esse comportamento depende do tratamento do callback em [src/auth.js](C:/Users/rguimaraes/OneDrive%20-%20MARCHER%20BRASIL%20AGROINDUSTRIAL%20SA/%C3%81rea%20de%20Trabalho/controla-marcher/src/auth.js).

## Fotos e webcam

Nos cadastros de visitantes e motoristas:

- é possível enviar imagem por arquivo
- é possível capturar imagem por webcam
- a webcam depende de contexto seguro (`https` ou `localhost`)
- o navegador pode exigir permissão explícita do usuário

As imagens são tratadas no cliente antes do envio, reduzindo tamanho para uso operacional no sistema.

## Perfis de acesso

| Perfil | Escopo esperado |
| --- | --- |
| `Super Admin` | acesso total, inclusive administração completa de usuários |
| `Admin` | acesso amplo, com restrições sobre usuários de nível superior |
| `Segurança` | operação do dia a dia, entradas, saídas e rotinas operacionais |
| `Consulta` | acesso de leitura |

## Exclusão de registros

O projeto trabalha com exclusão lógica nos cadastros e registros operacionais relevantes:

- o registro recebe marcação de exclusão
- ele deixa de aparecer nas listagens normais
- pode permanecer disponível para consulta ou restauração conforme a regra da tela

## Observações técnicas

- A persistência é feita por registro, reduzindo risco de sobrescrever alterações paralelas.
- O app mantém cache em memória para renderização e operação das telas.
- A validação de banco e storage pode ser apoiada por `sql/validation_queries.sql`.
- O login, a recuperação de senha e o carregamento do perfil passam por `src/auth.js`.
- A maior parte da UI e dos handlers globais está concentrada em `src/app.js`.

## Publicação

Para publicar com segurança:

1. validar o fluxo de login
2. validar o fluxo de recuperação de senha
3. validar upload e webcam em ambiente HTTPS
4. validar permissões por perfil
5. validar Edge Functions `invite-user` e `manage-user`

## Status atual da documentação

Este `README` foi atualizado para refletir o estado atual do projeto no repositório, incluindo:

- uso atual de `src/config.js`
- painel de usuários com definição direta de senha
- recuperação de senha pela tela de login
- uso de webcam nos cadastros

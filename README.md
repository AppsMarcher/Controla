# Controla Marcher - Controle de Portaria

App de portaria (entradas/saidas, cadastros, entregas, ramais) em projeto **Vite**,
com camada de dados plugavel: **Supabase** (producao) ou **localStorage** (dev/fallback),
escolhido automaticamente pela presenca das variaveis de ambiente.

## Rodar localmente

```bash
npm install
npm run dev
```

Sem `.env`, o app sobe em **modo localStorage** (sem login), util para desenvolver a UI.

## Ligar o Supabase

1. Crie o projeto no Supabase.
2. No **SQL Editor**, rode `sql/schema.sql` e depois `sql/seed_ramais.sql`.
3. Para fotos no Supabase Storage, rode tambem `sql/storage_photos.sql`.
4. Crie os usuarios em **Authentication > Users**.
5. Promova o primeiro admin:
   ```sql
   update public.profiles set perfil = 'Administrador'
   where id = (select id from auth.users where email = 'voce@marcher.com.br');
   ```
6. Copie `.env.example` para `.env` e preencha:
   ```
   VITE_SUPABASE_URL=...
   VITE_SUPABASE_ANON_KEY=...
   VITE_SUPABASE_PHOTOS_BUCKET=fotos
   ```
7. Rode `npm run dev`.

### Convite de usuarios por e-mail

Para o botao `Cadastrar usuario` funcionar com convite por e-mail:

1. Faca o deploy da Edge Function `supabase/functions/invite-user`.
2. Configure o secret `INVITE_REDIRECT_TO` com a URL publica do app.
3. Garanta que o template de convite do Supabase Auth esteja ativo.

Depois disso, o ADM pode informar `e-mail + perfil` no app e o usuario conclui o cadastro pelo e-mail.

> A `anon key` e publica por design; quem protege os dados e o **RLS**.

## Estrutura

```text
index.html              shell (markup + login)
src/
  styles.css            estilos
  config.js             le env e decide o backend
  main.js               bootstrap: login -> perfil -> dados -> render
  auth.js               sessao, login, perfil e gestao de usuarios
  app.js                UI e logica
  data/
    client.js           cliente Supabase
    seed.js             sementes do modo localStorage
    local.js            adapter localStorage
    supabase.js         adapter Supabase
    storage.js          upload/remocao de fotos no Storage
    repo.js             seleciona o adapter ativo
sql/
  schema.sql            tabelas + RLS + triggers
  seed_ramais.sql       ramais iniciais
  storage_photos.sql    bucket e policies do Storage
  validation_queries.sql consultas de validacao
```

## Perfis de acesso

- **Administrador**: faz tudo.
- **Seguranca**: le tudo, grava **acessos** e **entregas**, e pode fazer cadastro rapido operacional de visitante/motorista/veiculo durante a entrada.
- **Consultas**: leitura apenas.

## Notas tecnicas

- IDs sao `text` (o mesmo `uid()` do app).
- A persistencia normal e **por registro**, para nao apagar dados de outro usuario em operacao paralela.
- A restauracao de backup continua sendo uma substituicao total e deve ser usada apenas por administrador.
- Fotos agora podem ser gravadas no **Supabase Storage** (bucket publico `fotos`) e o link publico fica salvo nas tabelas.
- Para validar a persistencia no banco e no Storage, use `sql/validation_queries.sql`.

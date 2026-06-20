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

| Perfil | Acessos | Cadastros | Operacoes | Relatorios | Usuarios |
|--------|---------|-----------|-----------|------------|---------|
| Super Admin | total | total | total | total | total |
| Admin | total | total | total | total | exceto Super Admin |
| Seguranca | leitura | cadastro rapido na entrada | entradas/saidas/entregas | — | — |
| Consulta | leitura | — | — | leitura | — |

## Exclusao de registros

Todas as exclusoes sao **soft delete**: o registro recebe `deleted_at` e `deleted_by` e some das listagens normais, mas fica acessivel em **Relatorios > Arquivados** para restauracao. Nada e apagado fisicamente pelo app.

## Notas tecnicas

- IDs sao `text` (gerados por `uid()` no cliente).
- A persistencia e **por registro** (`saveRow`), evitando sobrescrever dados de outro usuario em operacao paralela. O backup JSON e a unica operacao que substitui tudo de uma vez — uso exclusivo do Admin.
- Fotos sao reduzidas no cliente (max 360 px, JPEG 82 %) antes do upload para o Supabase Storage. Durante o envio, o botao Salvar fica desabilitado com indicador visual.
- Buscas e autocompletes usam debounce (200–300 ms) para nao iterar os registros em cada tecla.
- Toasts ficam limitados a 3 simultaneos; o mais antigo e removido automaticamente ao chegar um novo.
- Para validar a persistencia no banco e no Storage, use `sql/validation_queries.sql`.

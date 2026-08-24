# Frontend IA Contexto (ECG)

Regras compartilhadas de arquitetura, domínio e convenções estão no
[`AGENTS.md`](../../AGENTS.md). Este arquivo mantém apenas extras específicos
do frontend.

## Escopo

O frontend está em `apps/mobile` e atende dois perfis: `PERSONAL` e `ALUNO`.
A API consumida é o backend FastAPI em `/api/v1`.

## Pontos críticos

A base URL da API fica em `apps/mobile/src/api/client.ts`.
A prioridade de resolução é:

1. `EXPO_PUBLIC_API_URL`
2. Em dev (`__DEV__`): host detectado pelo Expo (`expoConfig.hostUri`) → fallback `extra.apiHost` → `127.0.0.1`
3. Em build de produção sem env: fallback fixo `https://api.ecg.com/api/v1`

Endpoints `/admin/` recebem o header `X-Admin-Key` automaticamente quando
`EXPO_PUBLIC_ADMIN_API_KEY` (ou `extra.adminApiKey`) está definido.
O refresh de token em 401 não é tentado para endpoints admin.

## Comandos úteis

Na raiz:

```bash
pnpm dev:mobile
```

Dentro de `apps/mobile`:

```bash
pnpm start
pnpm android
pnpm ios
pnpm typecheck
pnpm lint
```

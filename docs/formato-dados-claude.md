# O que o Claude Code grava no disco

Levantado nesta máquina em 09/09/2026, Claude Code **2.1.266**. Vale para esta
versão; o formato já mudou entre versões (os subagentes, por exemplo, saíram de
`isSidechain` no arquivo principal para arquivos próprios).

## Onde ficam as coisas

| Caminho | O que é |
|---|---|
| `~/.claude/sessions/<pid>.json` | registro do processo: `pid`, `sessionId`, `cwd`, `name`, `startedAt`, `procStart`, `entrypoint`, `kind` |
| `~/.claude/history.jsonl` | índice global, uma linha por prompt humano: `{display, timestamp, project, sessionId}` |
| `~/.claude/projects/<slug>/<sessionId>.jsonl` | a transcrição |
| `~/.claude/projects/<slug>/<sessionId>/subagents/agent-<id>.jsonl` | transcrição do subagente |
| `~/.claude/projects/<slug>/<sessionId>/subagents/agent-<id>.meta.json` | `agentType`, `description`, `toolUseId`, `spawnDepth` |
| `~/.claude/settings.json` | config global, incluindo `hooks` |

**Não existe** `~/.claude/todos/` nesta versão — os todos vivem na transcrição.

### O slug

É o caminho absoluto com `:`, `\`, `/` e `_` trocados por `-`. **O case da
letra do drive é preservado**, então coexistem no mesmo nível:

```
C--Users-EVO-Documents-tutorpro
c--Users-EVO-Documents-marcabot
```

Reconstruir o nome do diretório a partir do `cwd` e comparar com `===` falha em
metade dos casos. Indexe os diretórios reais e resolva por chave
`toLowerCase()`, guardando o nome de disco para montar o caminho — é o que
[slug.service.js](../backend/src/services/slug.service.js) faz.

## Escala medida

- 203 transcrições principais + 147 de subagente, **277 MB**
- maior arquivo: **56 MB**
- ler 512 KB do fim desse arquivo: **11 ms**, rendendo 206 linhas (65
  `assistant`, 33 `user`) — mais que suficiente para derivar o estado
- encoding: UTF-8 **sem BOM**, **LF puro**, arquivo termina em `\n`

## Tipos de linha

15 tipos observados em 2.240 linhas. Só três carregam significado
conversacional: `assistant`, `user`, `system`.

| Tipo | Frequência | Serve para |
|---|---|---|
| `assistant` | 704 | estado, fala, ferramentas, tokens |
| `attachment` | 463 | — |
| `user` | 379 | prompt humano ou `tool_result` |
| `bridge-session` | 120 | — |
| `atis-latch` | 118 | — |
| `last-prompt` | 116 | último prompt |
| `mode` / `permission-mode` | 143 | — |
| `queue-operation` | 68 | enfileiramento de mensagens (**não** de permissões) |
| `ai-title` | 63 | título legível da sessão |
| `system` | 28 | `turn_duration`, `stop_hook_summary`, `scheduled_task_fire` |
| `file-history-*` | 48 | — |
| `pr-link` | 8 | — |
| `cost-state` | 2 | **única** fonte de custo em USD |

Não existe `type: "summary"` — o equivalente é `ai-title`.

### Campos comuns

`parentUuid`, `isSidechain`, `type`, `uuid`, `timestamp` (ISO **UTC**, sufixo
`Z`), `sessionId`, `cwd`, `version`, `gitBranch`, `slug`.

### `assistant`

`message: { model, id, role, content[], stop_reason, usage }`, mais
`apiBlockIndex`, `requestId`, `effort`.

**Cada bloco de conteúdo vira uma linha própria**, com o mesmo `message.id` e
`apiBlockIndex` 0,1,2. Uma resposta com thinking + texto + `tool_use` gera três
linhas `assistant`, **todas repetindo o mesmo `usage`**.

`usage`: `input_tokens`, `output_tokens`, `cache_creation_input_tokens`,
`cache_read_input_tokens`, `output_tokens_details.thinking_tokens`. Não há
custo em USD por linha.

### `user`

`message.content` é uma **string crua** quando é prompt humano, ou um array com
`{type: "tool_result", tool_use_id, content, is_error}` quando é retorno de
ferramenta. `origin.kind === "human"` marca prompt humano real;
`isMeta: true` / `turnCompanion: true` marcam linhas de sistema que não são
fala do usuário.

`toolUseResult` traz o resultado estruturado — e é dele que saem os todos:
`toolUseResult.newTodos` com `{content, status, activeForm}`.

`toolDenialKind` (`permission-rule`, `user-rejected`, `automode-blocked`)
aparece numa linha **já resolvida**: é registro post-mortem, serve para
histórico, não para estado ao vivo.

### `cost-state`

`totalCostUSD`, `totalDuration`, `totalAPIDuration`, `totalLinesAdded/Removed`,
`startTime`, `modelUsage[modelo].costUSD`.

É escrita ao **encerrar** a sessão e é sempre a última linha. Medido: presente
em 4 de 56 transcrições. Sessão viva normalmente não tem custo.

## Detecção de sessão viva

Duas condições, **as duas** necessárias:

1. existe `~/.claude/sessions/<pid>.json`;
2. o PID existe **e** o `procStart` bate.

`procStart` é um FILETIME (ticks de 100 ns desde 1601). Compare com
`(Get-Process -Id N).StartTime.ToFileTime().ToString()`. O Windows recicla PIDs
rápido e há registros órfãos em `sessions/` — confiar só no PID mostraria
sessão morta como viva, ou atribuiria a transcrição errada.

O processo se chama **`claude`** (instalação nativa, não `node.exe`). Uma
chamada `Get-Process claude | Select Id, StartTime, CPU` traz todos de uma vez.

> **PowerShell 5.1**: `ConvertTo-Json` não tem `-AsArray` e devolve objeto solto
> quando há um resultado só. Use `@(...)` para forçar array e trate os dois
> casos no parse.

## O que não é detectável só lendo arquivos

**Enquanto um prompt de permissão está na tela, nada é anexado ao `.jsonl`.**
"Esperando você aprovar" e "rodando um Bash de 40 s" são byte a byte
indistinguíveis no transcript. Por isso o painel usa o hook `PermissionRequest`
para esse caso — ver [hooks](../backend/src/hooks/install.js).

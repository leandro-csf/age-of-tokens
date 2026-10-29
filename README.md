# Age of Tokens

Uma aldeia que evolui sozinha conforme você usa o Claude: cada resposta e cada sessão alimentam a aldeia, sem nenhuma decisão sua. Feita para ficar aberta num tablet deitado (1340×800) ao lado do trabalho.

O jogo **só lê** `~/.claude` (as transcrições do Claude Code) para contar tokens e sessões. Nunca escreve lá.

## Rodar

```bash
npm start
```

Precisa do Node 20+ e **não tem dependências para instalar**. O terminal mostra os endereços:

```
  neste computador:       http://localhost:4100
  no tablet (mesma rede): http://192.168.1.6:4100   [Ethernet]
```

Abra o endereço da rede no tablet (mesmo Wi-Fi). O progresso é salvo em `data/save.json`.

> **Atenção:** o servidor escuta em toda a rede local de propósito. A API é só leitura, mas qualquer aparelho na sua rede vê os seus totais de tokens. Para fechar de volta: `HOST=127.0.0.1 npm start`. Se o tablet não conectar, libere a porta 4100 no firewall do Windows.

Opções: `PORT`, `HOST`, `STEP_MS` (ritmo da aldeia, padrão 3000), `CLAUDE_HOME`, `SAVE_FILE`; `--history` conta todo o histórico existente em vez de começar do zero.

## Arte (obrigatório)

Os sprites são o **Tiny Swords (Free Pack)**, de Pixel Frog, e a licença **não permite redistribuir** os arquivos, então eles não vêm no repositório. Sem eles a página só mostra as instruções. Baixe e extraia em `web/assets/tiny-swords/`: passo a passo em [`docs/ASSETS.md`](docs/ASSETS.md).

Fontes (OFL) e ícones do app são próprios e estão no repositório.

## No tablet

- **Tela cheia:** botão no canto inferior direito.
- **Detalhes:** toque na barra de recursos (tokens crus, população, pesquisas, obra). Há também o botão **Compartilhar aldeia**, que gera uma imagem PNG com a era, o nível e os tokens.
- **Instalar como app (PWA) e abrir offline:** o navegador só permite isso em contexto seguro (`localhost` ou HTTPS). Em `http://192.168.x.x` o service worker **não registra**; o jogo funciona normalmente, mas sem instalação nem modo offline. Para ter o PWA completo: sirva por HTTPS (um túnel como Tailscale Serve ou Cloudflare Tunnel) ou, no Chrome do tablet, habilite `chrome://flags/#unsafely-treat-insecure-origin-as-secure` para o endereço do seu computador.

## Como funciona

| Pasta | O que faz |
|---|---|
| `ingest/` | lê `~/.claude/projects` de forma incremental (offset persistido, sem contar nada duas vezes) e emite eventos de tokens, sessões e ferramentas |
| `sim/` | motor puro: tokens viram recursos, o decisor automático constrói, pesquisa e avança de era (regras em `docs/REGRAS.md`) |
| `server/` | junta tudo, salva e serve HTTP/SSE (só GET) |
| `web/` | a tela: ilha vista de cima que evolui em 11 estágios por nível, HUD, PWA e cartão |
| `docs/` | conceito, regras, decisões e progresso |

O nível da aldeia depende só da renda vitalícia, com a mesma curva para todos, então dá para comparar aldeias entre jogadores.

## Testes

```bash
npm test
```

Cobrem a ingestão, o motor, o servidor, o layout dos estágios, a navegação dos aldeões e a lógica do service worker (num ambiente simulado). A renderização em canvas e o registro real do service worker não são testáveis no Node e foram conferidos à mão.

## Créditos

Arte: [Tiny Swords](https://pixelfrog-assets.itch.io/tiny-swords) por Pixel Frog. Fontes: Jacquard 12, Pixelify Sans e Silkscreen (SIL OFL 1.1).

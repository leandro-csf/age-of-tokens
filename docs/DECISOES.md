# Decisões

## 2026-10-29
- Uma aldeia global (todos os projetos alimentam a mesma). Motivo: simples e dá sensação clara de progresso.
- Pixel art isométrico, canvas 2D, portrait de celular, PWA.
- Ociosidade só faz a aldeia dormir, sem perda. Motivo: relaxante, sem irritar.
- Repo novo e independente; reuso do evo_session_manager por cópia/adaptação. Stack definida aos poucos.
- Persistência própria (save + checkpoint de offsets e message.id já contados), porque o session manager não guarda histórico.

## 2026-10-29 (ingestao)
- Ingestao propria no repo: tailer incremental lendo ~/.claude/projects, sem depender do session manager rodando. Motivo: repo independente e contagem exata com historico no proprio save.
- Tailer reescrito (nao copiado): guarda so `committed`, o offset apos a ultima linha completa. Linha parcial e relida, sem decoder/buffer em memoria. Motivo: offset persistivel e sem duplicar bytes.
- Dedupe por message.id com anel de 500 ids persistido no save (sobrevive a reinicio no meio de uma resposta).
- Baseline configuravel: `now` (ignora historico) ou `history` (conta tudo). Padrao do CLI: `now`. DECIDIDO (2026-10-29): comeca do zero, o historico existente nao credita a aldeia.
- Escala medida (historico completo, 2026-10-29): 263 arquivos, 13.164 respostas, ~11,9M output, ~2,36 bilhoes cache read, ~3M thinking, 17.536 tool_use; leitura total em ~7 s. Cache read e ~200x o output, entao a economia precisa de pesos por tipo de token.

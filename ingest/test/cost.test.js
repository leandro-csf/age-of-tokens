import test from 'node:test';
import assert from 'node:assert/strict';
import { createTokenAccumulator, parseCostState } from '../src/parsers/cost.parser.js';
import { parseTodos, countTodos } from '../src/parsers/todo.parser.js';

test('blocos da mesma resposta contam tokens uma vez só', () => {
  /*
   * Cada bloco de conteudo vira uma linha `assistant` propria, com o MESMO
   * message.id e apiBlockIndex 0,1,2 — thinking + texto + tool_use gera 3
   * linhas. Somar sem deduplicar triplicaria os tokens.
   */
  const acc = createTokenAccumulator();
  const usage = { input_tokens: 10, output_tokens: 100, cache_read_input_tokens: 5000,
                  output_tokens_details: { thinking_tokens: 40 } };

  for (const apiBlockIndex of [0, 1, 2]) {
    acc.add({ apiBlockIndex, requestId: 'req_1', message: { id: 'msg_1', usage } });
  }

  assert.equal(acc.totals.output, 100, 'nao pode triplicar');
  assert.equal(acc.totals.input, 10);
  assert.equal(acc.totals.cacheRead, 5000);
  assert.equal(acc.totals.thinking, 40);

  // resposta seguinte, message.id diferente: soma normalmente
  acc.add({ apiBlockIndex: 0, requestId: 'req_2', message: { id: 'msg_2', usage } });
  assert.equal(acc.totals.output, 200);
});

test('linha sem usage ou sem id é ignorada', () => {
  const acc = createTokenAccumulator();
  assert.equal(acc.add({ message: { id: 'x' } }), false);
  assert.equal(acc.add({ message: { usage: { output_tokens: 5 } } }), false);
  assert.equal(acc.totals.output, 0);
});

test('cost-state é a única fonte de custo em USD', () => {
  const c = parseCostState({
    type: 'cost-state', totalCostUSD: 18.63, totalDuration: 5904717,
    totalLinesAdded: 3879, totalLinesRemoved: 238,
    modelUsage: { 'claude-sonnet-5': { costUSD: 18.63 } },
  });
  assert.equal(c.totalCostUSD, 18.63);
  assert.equal(c.linesAdded, 3879);
  assert.equal(parseCostState({ type: 'assistant' }), null);
});

test('todos vêm do toolUseResult.newTodos', () => {
  // nao existe pasta ~/.claude/todos/ nesta versao: os todos vivem na transcricao
  const todos = parseTodos({
    toolUseResult: {
      oldTodos: [],
      newTodos: [
        { content: 'A', status: 'completed', activeForm: 'Fazendo A' },
        { content: 'B', status: 'in_progress', activeForm: 'Fazendo B' },
        { content: 'C', status: 'pending', activeForm: 'Fazendo C' },
      ],
    },
  });
  assert.equal(todos.length, 3);
  assert.deepEqual(countTodos(todos), { open: 2, total: 3, done: 1 });
  assert.equal(parseTodos({ toolUseResult: { type: 'text' } }), null);
});

test('status desconhecido cai para pending', () => {
  const todos = parseTodos({ toolUseResult: { newTodos: [{ content: 'X', status: 'inventado' }] } });
  assert.equal(todos[0].status, 'pending');
});

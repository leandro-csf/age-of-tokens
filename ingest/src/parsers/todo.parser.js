/**
 * TODOs nao vivem em ~/.claude/todos/ (essa pasta nao existe nesta versao).
 * Eles estao na propria transcricao: o resultado de um TodoWrite traz
 * toolUseResult.newTodos. Vale sempre o ULTIMO encontrado.
 */
export function parseTodos(entry) {
  const todos = entry?.toolUseResult?.newTodos;
  if (!Array.isArray(todos)) return null;
  return todos.map(t => ({
    content: String(t.content ?? ''),
    status: t.status === 'completed' || t.status === 'in_progress' ? t.status : 'pending',
    activeForm: String(t.activeForm ?? ''),
  }));
}

export function countTodos(todos) {
  if (!Array.isArray(todos) || todos.length === 0) return { open: 0, total: 0, done: 0 };
  const done = todos.filter(t => t.status === 'completed').length;
  return { open: todos.length - done, total: todos.length, done };
}

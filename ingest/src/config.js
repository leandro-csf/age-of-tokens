import os from 'node:os';
import path from 'node:path';

const home = process.env.CLAUDE_HOME || path.join(os.homedir(), '.claude');

// Config enxuta adaptada de evo_session_manager. Cresce conforme a ingestao for portada.
export const config = {
  state: { dedupRingSize: 500 },
  claude: {
    home,
    projectsDir: path.join(home, 'projects'),
  },
  read: {
    chunkBytes: 8 * 1024 * 1024, // teto por leitura; linha maior que isso dobra a janela
    pollMs: 2000,
  },
};

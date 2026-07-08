import { createApp } from './app';
import { env } from './config/env';
import { pool } from './db/pool';

const app = createApp();

// Escuta em 0.0.0.0 para responder também de dentro de um container.
const server = app.listen(env.port, '0.0.0.0', () => {
  console.log(`Servidor ouvindo em http://0.0.0.0:${env.port}`);
});

let shuttingDown = false;

// Encerramento gracioso: para de aceitar novas conexões, fecha o servidor HTTP
// e o pool do MySQL, e sai com código 0 em bem menos de 10 segundos. Relevante
// porque o processo Node roda como PID 1 dentro do container.
async function shutdown(signal: string): Promise<void> {
  if (shuttingDown) {
    return;
  }
  shuttingDown = true;
  console.log(`Recebido ${signal}. Encerrando graciosamente...`);

  // Rede de segurança: se algo travar, força a saída bem antes do SIGKILL.
  const forceExit = setTimeout(() => {
    console.error('Encerramento forçado após timeout.');
    process.exit(1);
  }, 8000);
  forceExit.unref();

  server.close(async (err) => {
    if (err) {
      console.error('Erro ao fechar o servidor HTTP:', err);
    }
    try {
      await pool.end();
    } catch (poolErr) {
      console.error('Erro ao fechar o pool do MySQL:', poolErr);
    }
    console.log('Encerramento concluído.');
    process.exit(0);
  });
}

process.on('SIGTERM', () => {
  void shutdown('SIGTERM');
});
process.on('SIGINT', () => {
  void shutdown('SIGINT');
});

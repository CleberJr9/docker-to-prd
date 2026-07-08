import type { ErrorRequestHandler } from 'express';
import { HttpError } from './http-error';

interface MysqlError {
  code?: string;
}

function isDuplicateEntry(err: unknown): boolean {
  return typeof err === 'object' && err !== null && (err as MysqlError).code === 'ER_DUP_ENTRY';
}

function isBodyParseError(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    (err as { type?: string }).type === 'entity.parse.failed'
  );
}

// Error handler central: converte erros em respostas JSON consistentes.
export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof HttpError) {
    res.status(err.status).json({
      error: err.message,
      ...(err.details !== undefined ? { details: err.details } : {}),
    });
    return;
  }

  if (isBodyParseError(err)) {
    res.status(400).json({ error: 'JSON inválido no corpo da requisição' });
    return;
  }

  if (isDuplicateEntry(err)) {
    res.status(409).json({ error: 'E-mail já cadastrado' });
    return;
  }

  console.error('Erro não tratado:', err);
  res.status(500).json({ error: 'Erro interno do servidor' });
};

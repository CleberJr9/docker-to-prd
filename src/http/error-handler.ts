import type { ErrorRequestHandler } from 'express';
import { HttpError } from './http-error';

interface PgError {
  code?: string;
}

function isUniqueViolation(err: unknown): boolean {
  return typeof err === 'object' && err !== null && (err as PgError).code === '23505';
}

function isBodyParseError(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    (err as { type?: string }).type === 'entity.parse.failed'
  );
}

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

  if (isUniqueViolation(err)) {
    res.status(409).json({ error: 'key já cadastrada' });
    return;
  }

  console.error('Erro não tratado:', err);
  res.status(500).json({ error: 'Erro interno do servidor' });
};

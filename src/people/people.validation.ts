import { badRequest } from '../http/http-error';
import type { PersonInput } from './people.repository';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Validação básica do payload de criação/atualização de uma pessoa.
// Lança 400 (via badRequest) com a lista de problemas encontrados.
export function validatePersonInput(body: unknown): PersonInput {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    throw badRequest('Payload inválido: esperado um objeto JSON');
  }

  const { name, email } = body as Record<string, unknown>;
  const errors: string[] = [];

  if (typeof name !== 'string' || name.trim() === '') {
    errors.push('name é obrigatório e deve ser uma string não vazia');
  }

  if (typeof email !== 'string' || email.trim() === '') {
    errors.push('email é obrigatório e deve ser uma string não vazia');
  } else if (!EMAIL_REGEX.test(email.trim())) {
    errors.push('email deve ter um formato válido');
  }

  if (errors.length > 0) {
    throw badRequest('Validação falhou', errors);
  }

  return {
    name: (name as string).trim(),
    email: (email as string).trim(),
  };
}

// Converte o parâmetro de rota :id em um inteiro positivo, ou lança 400.
export function parseId(raw: unknown): number {
  const value = typeof raw === 'string' ? raw : '';
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) {
    throw badRequest('id inválido: deve ser um inteiro positivo');
  }
  return id;
}

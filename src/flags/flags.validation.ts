import { badRequest } from '../http/http-error';
import type { FlagCreateInput, FlagUpdateInput } from './flags.repository';

// key pública em kebab-case, de 1 a 100 caracteres.
const KEY_REGEX = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const KEY_MAX_LENGTH = 100;

function isPlainObject(body: unknown): body is Record<string, unknown> {
  return typeof body === 'object' && body !== null && !Array.isArray(body);
}

function isValidKey(value: unknown): value is string {
  return typeof value === 'string' && value.length <= KEY_MAX_LENGTH && KEY_REGEX.test(value);
}

// Valida o corpo de criação: { key, description, enabled? }.
export function validateFlagCreate(body: unknown): FlagCreateInput {
  if (!isPlainObject(body)) {
    throw badRequest('Payload inválido: esperado um objeto JSON');
  }

  const { key, description, enabled } = body;
  const errors: string[] = [];

  if (!isValidKey(key)) {
    errors.push('key é obrigatória e deve estar em kebab-case (^[a-z0-9]+(-[a-z0-9]+)*$), de 1 a 100 caracteres');
  }

  if (typeof description !== 'string' || description.trim() === '') {
    errors.push('description é obrigatória e deve ser uma string não vazia');
  }

  let enabledValue = false;
  if (enabled !== undefined) {
    if (typeof enabled !== 'boolean') {
      errors.push('enabled, quando presente, deve ser boolean');
    } else {
      enabledValue = enabled;
    }
  }

  if (errors.length > 0) {
    throw badRequest('Validação falhou', errors);
  }

  return {
    key: key as string,
    description: (description as string).trim(),
    enabled: enabledValue,
  };
}

// Valida o corpo de atualização: { description, enabled? }. A key é imutável e
// vem da rota, não do corpo.
export function validateFlagUpdate(body: unknown): FlagUpdateInput {
  if (!isPlainObject(body)) {
    throw badRequest('Payload inválido: esperado um objeto JSON');
  }

  const { description, enabled } = body;
  const errors: string[] = [];

  if (typeof description !== 'string' || description.trim() === '') {
    errors.push('description é obrigatória e deve ser uma string não vazia');
  }

  let enabledValue = false;
  if (enabled !== undefined) {
    if (typeof enabled !== 'boolean') {
      errors.push('enabled, quando presente, deve ser boolean');
    } else {
      enabledValue = enabled;
    }
  }

  if (errors.length > 0) {
    throw badRequest('Validação falhou', errors);
  }

  return {
    description: (description as string).trim(),
    enabled: enabledValue,
  };
}

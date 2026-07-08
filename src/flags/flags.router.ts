import { Router } from 'express';
import { asyncHandler } from '../http/async-handler';
import { notFound } from '../http/http-error';
import * as repo from './flags.repository';
import { validateFlagCreate, validateFlagUpdate } from './flags.validation';

export const flagsRouter = Router();

function keyParam(raw: unknown): string {
  return typeof raw === 'string' ? raw : '';
}

flagsRouter.get(
  '/',
  asyncHandler(async (_req, res) => {
    const flags = await repo.findAll();
    res.json(flags);
  }),
);

flagsRouter.get(
  '/:key',
  asyncHandler(async (req, res) => {
    const flag = await repo.findByKey(keyParam(req.params.key));
    if (!flag) {
      throw notFound('Flag não encontrada');
    }
    res.json(flag);
  }),
);

flagsRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const input = validateFlagCreate(req.body);
    const created = await repo.create(input);
    res.status(201).json(created);
  }),
);

flagsRouter.put(
  '/:key',
  asyncHandler(async (req, res) => {
    const input = validateFlagUpdate(req.body);
    const updated = await repo.update(keyParam(req.params.key), input);
    if (!updated) {
      throw notFound('Flag não encontrada');
    }
    res.json(updated);
  }),
);

flagsRouter.delete(
  '/:key',
  asyncHandler(async (req, res) => {
    const deleted = await repo.remove(keyParam(req.params.key));
    if (!deleted) {
      throw notFound('Flag não encontrada');
    }
    res.status(204).send();
  }),
);

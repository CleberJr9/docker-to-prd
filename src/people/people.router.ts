import { Router } from 'express';
import { asyncHandler } from '../http/async-handler';
import { notFound } from '../http/http-error';
import * as repo from './people.repository';
import { parseId, validatePersonInput } from './people.validation';

export const peopleRouter = Router();

// GET /people — lista todas as pessoas.
peopleRouter.get(
  '/',
  asyncHandler(async (_req, res) => {
    const people = await repo.findAll();
    res.json(people);
  }),
);

// GET /people/:id — busca uma pessoa por id.
peopleRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const id = parseId(req.params.id);
    const person = await repo.findById(id);
    if (!person) {
      throw notFound('Pessoa não encontrada');
    }
    res.json(person);
  }),
);

// POST /people — cria uma pessoa.
peopleRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const input = validatePersonInput(req.body);
    const created = await repo.create(input);
    res.status(201).json(created);
  }),
);

// PUT /people/:id — atualiza uma pessoa por id.
peopleRouter.put(
  '/:id',
  asyncHandler(async (req, res) => {
    const id = parseId(req.params.id);
    const input = validatePersonInput(req.body);
    const updated = await repo.update(id, input);
    if (!updated) {
      throw notFound('Pessoa não encontrada');
    }
    res.json(updated);
  }),
);

// DELETE /people/:id — remove uma pessoa por id.
peopleRouter.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const id = parseId(req.params.id);
    const deleted = await repo.remove(id);
    if (!deleted) {
      throw notFound('Pessoa não encontrada');
    }
    res.status(204).send();
  }),
);

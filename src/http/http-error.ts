export class HttpError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

export const badRequest = (message: string, details?: unknown): HttpError =>
  new HttpError(400, message, details);

export const notFound = (message: string): HttpError => new HttpError(404, message);

export const conflict = (message: string): HttpError => new HttpError(409, message);

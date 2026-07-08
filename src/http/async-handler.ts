import type { NextFunction, Request, RequestHandler, Response } from 'express';

// Encapsula um handler assíncrono para que rejeições de Promise sejam
// encaminhadas ao error handler central (next(err)), independentemente da
// versão do Express.
export function asyncHandler(handler: RequestHandler): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
}

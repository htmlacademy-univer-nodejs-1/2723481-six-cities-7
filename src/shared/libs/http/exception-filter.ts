import {STATUS_CODES} from 'node:http';
import {ErrorRequestHandler} from 'express';
import {StatusCodes} from 'http-status-codes';
import {inject, injectable} from 'inversify';
import {Error as MongooseError} from 'mongoose';
import {Component} from '../../types/component.enum.js';
import {Logger} from '../logger/logger.interface.js';
import {HttpError} from './http-error.js';

@injectable()
export class ExceptionFilter {
  constructor(@inject(Component.Logger) private readonly logger: Logger) {}

  public readonly catch: ErrorRequestHandler = (error: unknown, req, res, next) => {
    const request = `${req.method} ${req.path}`;
    const status = this.clientStatus(error);

    if (status !== undefined) {
      const message = error instanceof HttpError ? error.message : STATUS_CODES[status] ?? 'Ошибка запроса.';
      this.logger.warn(`${request} — ${status}: ${message}`);
      if (res.headersSent) {
        return next(error);
      }
      res.status(status).json({message});
      return;
    }

    this.logger.error(`${request} — внутренняя ошибка сервера.`, error instanceof Error ? error : undefined);
    if (res.headersSent) {
      return next(error);
    }
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({message: 'Внутренняя ошибка сервера.'});
  };

  private clientStatus(error: unknown): number | undefined {
    if (error instanceof HttpError) {
      return error.status;
    }
    if (error instanceof MongooseError.ValidationError || error instanceof MongooseError.CastError) {
      return StatusCodes.BAD_REQUEST;
    }
    const status = (error as {status?: unknown} | null)?.status;
    return typeof status === 'number' && status >= 400 && status < 500 && Number.isInteger(status) ? status : undefined;
  }
}

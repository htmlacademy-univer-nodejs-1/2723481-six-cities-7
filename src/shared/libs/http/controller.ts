import {Router, Response} from 'express';
import asyncHandler from 'express-async-handler';
import {StatusCodes} from 'http-status-codes';
import {injectable} from 'inversify';
import {ControllerInterface} from './controller.interface.js';
import {Route} from './route.interface.js';

@injectable()
export abstract class Controller implements ControllerInterface {
  public readonly router = Router();

  protected addRoute<Body>({method, path, handler, middleware = []}: Route<Body>): void {
    this.router[method](path, ...middleware, asyncHandler(handler.bind(this)));
  }

  protected ok(res: Response, data: unknown): void {
    res.status(StatusCodes.OK).json(data);
  }

  protected created(res: Response, data: unknown): void {
    res.status(StatusCodes.CREATED).json(data);
  }

  protected noContent(res: Response): void {
    res.status(StatusCodes.NO_CONTENT).end();
  }
}

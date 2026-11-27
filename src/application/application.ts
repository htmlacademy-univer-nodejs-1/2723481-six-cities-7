import {once} from 'node:events';
import {Server} from 'node:http';
import express from 'express';
import {StatusCodes} from 'http-status-codes';
import {inject, injectable} from 'inversify';
import {Config} from '../shared/libs/config/config.interface.js';
import {Logger} from '../shared/libs/logger/logger.interface.js';
import {Component} from '../shared/types/component.enum.js';
import {DatabaseClient} from '../shared/libs/database-client/database-client.interface.js';
import {getMongoURI} from '../helpers/get-mongo-uri.js';
import {ControllerInterface} from '../shared/libs/http/controller.interface.js';
import {ExceptionFilter} from '../shared/libs/http/exception-filter.js';
import {HttpError} from '../shared/libs/http/http-error.js';

@injectable()
export class Application {
  private readonly server = express();

  constructor(
    @inject(Component.Logger) private readonly logger: Logger,
    @inject(Component.Config) private readonly config: Config,
    @inject(Component.DatabaseClient) private readonly databaseClient: DatabaseClient,
    @inject(Component.OfferController) private readonly offers: ControllerInterface,
    @inject(Component.UserController) private readonly users: ControllerInterface,
    @inject(Component.FavoriteController) private readonly favorites: ControllerInterface,
    @inject(Component.ExceptionFilter) private readonly exceptionFilter: ExceptionFilter,
  ) {}

  public async init(): Promise<Server> {
    this.registerMiddleware();
    await this.databaseClient.connect(getMongoURI(
      this.config.get('DB_HOST'), this.config.get('DB_PORT'), this.config.get('DB_NAME'),
      this.config.get('DB_USER'), this.config.get('DB_PASSWORD')
    ));
    const port = this.config.get('PORT');
    const listener = this.server.listen(port);
    try {
      await once(listener, 'listening');
    } catch (error) {
      await this.databaseClient.disconnect();
      throw error;
    }
    const address = listener.address();
    this.logger.info(`Приложение инициализировано. Порт: ${typeof address === 'object' && address ? address.port : port}.`);
    return listener;
  }

  private registerMiddleware(): void {
    this.server.use(express.json());
    this.server.use(this.offers.router, this.users.router, this.favorites.router);
    this.server.use((_req, _res, next) => next(new HttpError(StatusCodes.NOT_FOUND, 'Маршрут не найден.')));
    this.server.use(this.exceptionFilter.catch);
  }
}

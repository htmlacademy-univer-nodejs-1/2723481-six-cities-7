import {plainToInstance} from 'class-transformer';
import {Request, Response} from 'express';
import {StatusCodes} from 'http-status-codes';
import {inject, injectable} from 'inversify';
import {Controller} from '../../libs/http/controller.js';
import {HttpError} from '../../libs/http/http-error.js';
import {readObjectId} from '../../libs/http/request-id.js';
import {Component} from '../../types/component.enum.js';
import {AuthService} from '../user/auth.service.js';
import {UserService} from '../user/user-service.interface.js';
import {UserDocument} from '../user/user.entity.js';
import {toUserResponse} from '../user/user.response.js';
import {CreateOfferBody, OfferBodyDto, UpdateOfferBody} from './dto/offer-body.dto.js';
import {OfferService, OfferView} from './offer-service.interface.js';
import {toOfferResponse, toOfferSummary} from './offer.response.js';

const offerBodyOptions = {excludeExtraneousValues: true, exposeUnsetFields: false};
const cities = new Set(['Paris', 'Cologne', 'Brussels', 'Amsterdam', 'Hamburg', 'Dusseldorf']);

@injectable()
export class OfferController extends Controller {
  constructor(
    @inject(Component.OfferService) private readonly offers: OfferService,
    @inject(Component.UserService) private readonly users: UserService,
    @inject(Component.AuthService) private readonly auth: AuthService,
  ) {
    super();
    this.addRoute({method: 'get', path: '/offers', handler: this.list});
    this.addRoute({method: 'post', path: '/offers', handler: this.create});
    this.addRoute({method: 'get', path: '/offers/:offerId', handler: this.show});
    this.addRoute({method: 'patch', path: '/offers/:offerId', handler: this.update});
    this.addRoute({method: 'delete', path: '/offers/:offerId', handler: this.delete});
    this.addRoute({method: 'get', path: '/cities/:cityName/premium', handler: this.premium});
  }

  private async list(req: Request, res: Response): Promise<void> {
    const user = await this.auth.optionalUser(req);
    const {limit} = req.query;
    const count = typeof limit === 'string' && /^\d+$/.test(limit) ? Number(limit) : NaN;
    if (limit !== undefined && (!Number.isSafeInteger(count) || count < 1)) {
      throw new HttpError(StatusCodes.BAD_REQUEST, 'limit должен быть положительным целым числом.');
    }
    const offers = await this.offers.find(limit === undefined ? undefined : count, user?._id.toString());
    this.ok(res, offers.map(toOfferSummary));
  }

  private async create(req: Request<Request['params'], unknown, CreateOfferBody>, res: Response): Promise<void> {
    const author = await this.auth.requireUser(req);
    const body = plainToInstance(OfferBodyDto, req.body, offerBodyOptions);
    const offer = await this.offers.create({...body, author: author._id});
    this.created(res, toOfferResponse({...offer.toObject(), isFavorite: false}, toUserResponse(req, author)));
  }

  private async show(req: Request, res: Response): Promise<void> {
    const user = await this.auth.optionalUser(req);
    const offer = await this.findOffer(req, user?._id.toString());
    const author = await this.users.findById(offer.author.toString());
    if (!author) {
      throw new Error('Автор предложения отсутствует в базе данных.');
    }
    this.ok(res, toOfferResponse(offer, toUserResponse(req, author)));
  }

  private async update(req: Request<Request['params'], unknown, UpdateOfferBody>, res: Response): Promise<void> {
    const author = await this.auth.requireUser(req);
    const offer = await this.findOwnedOffer(req, author);
    const changes = plainToInstance(OfferBodyDto, req.body, offerBodyOptions);
    const updated = await this.offers.updateById(offer._id.toString(), changes);
    if (!updated) {
      throw new HttpError(StatusCodes.NOT_FOUND, 'Предложение не найдено.');
    }
    this.ok(res, toOfferResponse({...updated.toObject(), isFavorite: offer.isFavorite}, toUserResponse(req, author)));
  }

  private async delete(req: Request, res: Response): Promise<void> {
    const author = await this.auth.requireUser(req);
    const offer = await this.findOwnedOffer(req, author);
    if (!await this.offers.deleteById(offer._id.toString())) {
      throw new HttpError(StatusCodes.NOT_FOUND, 'Предложение не найдено.');
    }
    this.noContent(res);
  }

  private async premium(req: Request, res: Response): Promise<void> {
    const user = await this.auth.optionalUser(req);
    const {cityName} = req.params;
    if (!cities.has(cityName)) {
      throw new HttpError(StatusCodes.BAD_REQUEST, 'Неизвестный город.');
    }
    const offers = await this.offers.findPremiumByCity(cityName, user?._id.toString());
    this.ok(res, offers.map(toOfferSummary));
  }

  private async findOffer(req: Request, userId?: string): Promise<OfferView> {
    const offer = await this.offers.findById(readObjectId(req.params.offerId), userId);
    if (!offer) {
      throw new HttpError(StatusCodes.NOT_FOUND, 'Предложение не найдено.');
    }
    return offer;
  }

  private async findOwnedOffer(req: Request, author: UserDocument): Promise<OfferView> {
    const offer = await this.findOffer(req, author._id.toString());
    if (!offer.author.equals(author._id)) {
      throw new HttpError(StatusCodes.FORBIDDEN, 'Изменять или удалять предложение может только автор.');
    }
    return offer;
  }
}

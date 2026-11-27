import {Request, Response} from 'express';
import {StatusCodes} from 'http-status-codes';
import {inject, injectable} from 'inversify';
import {Controller} from '../../libs/http/controller.js';
import {HttpError} from '../../libs/http/http-error.js';
import {readObjectId} from '../../libs/http/request-id.js';
import {Component} from '../../types/component.enum.js';
import {OfferService, OfferView} from '../offer/offer-service.interface.js';
import {toOfferResponse, toOfferSummary} from '../offer/offer.response.js';
import {AuthService} from '../user/auth.service.js';
import {UserService} from '../user/user-service.interface.js';
import {toUserResponse} from '../user/user.response.js';

@injectable()
export class FavoriteController extends Controller {
  constructor(
    @inject(Component.OfferService) private readonly offers: OfferService,
    @inject(Component.UserService) private readonly users: UserService,
    @inject(Component.AuthService) private readonly auth: AuthService,
  ) {
    super();
    this.addRoute({method: 'get', path: '/favorites', handler: this.list});
    this.addRoute({method: 'put', path: '/favorites/:offerId', handler: this.add});
    this.addRoute({method: 'delete', path: '/favorites/:offerId', handler: this.remove});
  }

  private async list(req: Request, res: Response): Promise<void> {
    const user = await this.auth.requireUser(req);
    const offers = await this.offers.findFavorites(user._id.toString());
    this.ok(res, offers.map(toOfferSummary));
  }

  private async add(req: Request, res: Response): Promise<void> {
    const offer = await this.setFavorite(req, true);
    const author = await this.users.findById(offer.author.toString());
    if (!author) {
      throw new Error('Автор предложения отсутствует в базе данных.');
    }
    this.ok(res, toOfferResponse(offer, toUserResponse(req, author)));
  }

  private async remove(req: Request, res: Response): Promise<void> {
    await this.setFavorite(req, false);
    this.noContent(res);
  }

  private async setFavorite(req: Request, isFavorite: boolean): Promise<OfferView> {
    const user = await this.auth.requireUser(req);
    const offerId = readObjectId(req.params.offerId);
    const offer = await this.offers.setFavorite(offerId, user._id.toString(), {isFavorite});
    if (!offer) {
      throw new HttpError(StatusCodes.NOT_FOUND, 'Предложение не найдено.');
    }
    return offer;
  }
}

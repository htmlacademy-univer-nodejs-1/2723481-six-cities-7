import {fileURLToPath} from 'node:url';
import {Request, RequestHandler, Response} from 'express';
import {StatusCodes} from 'http-status-codes';
import {inject, injectable} from 'inversify';
import {mongo} from 'mongoose';
import asyncHandler from 'express-async-handler';
import multer, {MulterError} from 'multer';
import {Config} from '../../libs/config/config.interface.js';
import {Controller} from '../../libs/http/controller.js';
import {HttpError} from '../../libs/http/http-error.js';
import {readObjectId} from '../../libs/http/request-id.js';
import {toResponse} from '../../libs/http/response-object.js';
import {Component} from '../../types/component.enum.js';
import {AuthService} from './auth.service.js';
import {CreateUserDto} from './dto/create-user.dto.js';
import {LoginUserDto} from './dto/login-user.dto.js';
import {UploadAvatarDto} from './dto/upload-avatar.dto.js';
import {UserService} from './user-service.interface.js';
import {LoginResponse, toUserResponse} from './user.response.js';

const DEFAULT_AVATAR = fileURLToPath(new URL('../../../../markup/img/avatar.svg', import.meta.url));
const parseAvatar = multer({
  limits: {fileSize: 5 * 1024 * 1024, files: 1, fields: 0},
}).single('avatar');

@injectable()
export class UserController extends Controller {
  constructor(
    @inject(Component.Config) private readonly config: Config,
    @inject(Component.UserService) private readonly users: UserService,
    @inject(Component.AuthService) private readonly auth: AuthService,
  ) {
    super();
    this.addRoute({method: 'post', path: '/users/register', handler: this.register});
    this.addRoute({method: 'post', path: '/users/login', handler: this.login});
    this.addRoute({method: 'get', path: '/users/login', handler: this.checkAuth});
    this.addRoute({
      method: 'post',
      path: '/users/:userId/avatar',
      handler: this.uploadAvatar,
      middleware: [asyncHandler(this.authorizeAvatarUpload.bind(this)), this.parseAvatar],
    });
    this.addRoute({method: 'get', path: '/users/:userId/avatar', handler: this.getAvatar});
    this.addRoute({method: 'get', path: '/static/default-avatar.svg', handler: this.getDefaultAvatar});
  }

  private async register(req: Request<Request['params'], unknown, CreateUserDto>, res: Response): Promise<void> {
    if (await this.auth.optionalUser(req)) {
      throw new HttpError(StatusCodes.FORBIDDEN, 'Пользователь уже авторизован.');
    }

    const {name, email, password, type} = req.body;
    if (typeof email !== 'string' || typeof password !== 'string') {
      throw new HttpError(StatusCodes.BAD_REQUEST, 'Передайте email и пароль.');
    }
    if (await this.users.findByEmail(email)) {
      throw new HttpError(StatusCodes.CONFLICT, 'Пользователь с таким email уже существует.');
    }

    try {
      const user = await this.users.create({name, email, password, type}, this.config.get('SALT'));
      this.created(res, toUserResponse(req, user));
    } catch (error) {
      if (error instanceof mongo.MongoServerError && error.code === 11000) {
        throw new HttpError(StatusCodes.CONFLICT, 'Пользователь с таким email уже существует.');
      }
      throw error;
    }
  }

  private async login(req: Request<Request['params'], unknown, LoginUserDto>, res: Response): Promise<void> {
    const {user, token} = await this.auth.login(req.body);
    this.ok(res, toResponse(LoginResponse, {token, user: toUserResponse(req, user)}));
  }

  private async checkAuth(req: Request, res: Response): Promise<void> {
    this.ok(res, toUserResponse(req, await this.auth.requireUser(req)));
  }

  private async authorizeAvatarUpload(req: Request, _res: Response, next: Parameters<RequestHandler>[2]): Promise<void> {
    const user = await this.auth.requireUser(req);
    if (user._id.toString() !== readObjectId(req.params.userId)) {
      throw new HttpError(StatusCodes.FORBIDDEN, 'Изменить аватар может только владелец профиля.');
    }
    next();
  }

  private readonly parseAvatar: RequestHandler = (req, res, next) => {
    parseAvatar(req, res, (error?: unknown) => {
      if (!error) {
        return next();
      }
      const status = error instanceof MulterError && error.code === 'LIMIT_FILE_SIZE'
        ? StatusCodes.REQUEST_TOO_LONG
        : StatusCodes.BAD_REQUEST;
      next(new HttpError(status, 'Не удалось загрузить аватар. Ожидается один файл размером до 5 МБ.'));
    });
  };

  private async uploadAvatar(req: Request, res: Response): Promise<void> {
    if (!req.file) {
      throw new HttpError(StatusCodes.BAD_REQUEST, 'Передайте файл в поле avatar.');
    }
    const {mimetype, buffer} = req.file;
    if (mimetype !== 'image/jpeg' && mimetype !== 'image/png') {
      throw new HttpError(StatusCodes.UNSUPPORTED_MEDIA_TYPE, 'Поддерживаются изображения JPEG и PNG.');
    }

    const avatar: UploadAvatarDto = {contentType: mimetype, data: buffer};
    const userId = readObjectId(req.params.userId);
    const user = await this.users.updateById(userId, {avatarPath: `/users/${userId}/avatar`, avatar});
    if (!user) {
      throw new HttpError(StatusCodes.NOT_FOUND, 'Пользователь не найден.');
    }
    this.ok(res, toUserResponse(req, user));
  }

  private async getAvatar(req: Request, res: Response): Promise<void> {
    const avatar = await this.users.findAvatarById(readObjectId(req.params.userId));
    if (!avatar) {
      throw new HttpError(StatusCodes.NOT_FOUND, 'Аватар не найден.');
    }
    res.set('X-Content-Type-Options', 'nosniff').type(avatar.contentType).send(avatar.data);
  }

  private getDefaultAvatar(_req: Request, res: Response): void {
    res.sendFile(DEFAULT_AVATAR);
  }
}

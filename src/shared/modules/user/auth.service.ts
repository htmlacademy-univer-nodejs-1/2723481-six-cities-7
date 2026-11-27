import {createHmac, timingSafeEqual} from 'node:crypto';
import {Request} from 'express';
import {StatusCodes} from 'http-status-codes';
import {inject, injectable} from 'inversify';
import jwt from 'jsonwebtoken';
import {isObjectIdOrHexString} from 'mongoose';
import {Config} from '../../libs/config/config.interface.js';
import {HttpError} from '../../libs/http/http-error.js';
import {Component} from '../../types/component.enum.js';
import {LoginUserDto} from './dto/login-user.dto.js';
import {hashPassword} from './hash-password.js';
import {UserService} from './user-service.interface.js';
import {UserDocument} from './user.entity.js';

@injectable()
export class AuthService {
  private readonly signingKey: Buffer;

  constructor(
    @inject(Component.Config) private readonly config: Config,
    @inject(Component.UserService) private readonly users: UserService,
  ) {
    this.signingKey = createHmac('sha256', config.get('SALT')).update('six-cities/access-token').digest();
  }

  public async login({email, password}: LoginUserDto): Promise<{user: UserDocument; token: string}> {
    if (typeof email !== 'string' || typeof password !== 'string') {
      throw new HttpError(StatusCodes.BAD_REQUEST, 'Передайте email и пароль.');
    }
    const user = await this.users.findByEmail(email);
    const supplied = await hashPassword(password, this.config.get('SALT'));
    const stored = user ? Buffer.from(user.password, 'hex') : Buffer.alloc(0);

    if (!user || stored.length !== supplied.length || !timingSafeEqual(stored, supplied)) {
      throw new HttpError(StatusCodes.UNAUTHORIZED, 'Неверный email или пароль.');
    }

    const token = jwt.sign({}, this.signingKey, {algorithm: 'HS256', subject: user._id.toString(), expiresIn: '1h'});
    return {user, token};
  }

  public async optionalUser(req: Request): Promise<UserDocument | undefined> {
    const authorization = req.get('Authorization');
    if (authorization === undefined) {
      return undefined;
    }

    const match = /^Bearer (\S+)$/i.exec(authorization);
    if (!match) {
      throw new HttpError(StatusCodes.UNAUTHORIZED, 'Недействительный токен.');
    }

    let userId: string | undefined;
    try {
      const payload = jwt.verify(match[1], this.signingKey, {algorithms: ['HS256']});
      userId = typeof payload === 'object' ? payload.sub : undefined;
    } catch (error) {
      if (!(error instanceof jwt.JsonWebTokenError)) {
        throw error;
      }
      throw new HttpError(StatusCodes.UNAUTHORIZED, 'Недействительный или просроченный токен.');
    }

    const user = userId && isObjectIdOrHexString(userId) ? await this.users.findById(userId) : null;
    if (!user) {
      throw new HttpError(StatusCodes.UNAUTHORIZED, 'Пользователь не найден.');
    }
    return user;
  }

  public async requireUser(req: Request): Promise<UserDocument> {
    const user = await this.optionalUser(req);
    if (!user) {
      throw new HttpError(StatusCodes.UNAUTHORIZED, 'Требуется авторизация.');
    }
    return user;
  }
}

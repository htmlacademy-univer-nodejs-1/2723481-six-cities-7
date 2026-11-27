import {Expose} from 'class-transformer';
import {Request} from 'express';
import {UserType} from '../../../types/user.type.js';
import {toResponse} from '../../libs/http/response-object.js';
import {UserDocument} from './user.entity.js';

export class UserResponse {
  @Expose() public id!: string;
  @Expose() public name!: string;
  @Expose() public email!: string;
  @Expose() public avatarPath!: string;
  @Expose() public type!: UserType;
}

export class LoginResponse {
  @Expose() public token!: string;
  @Expose() public user!: UserResponse;
}

export function toUserResponse(req: Request, user: UserDocument): UserResponse {
  const origin = `${req.protocol}://${req.get('host') ?? 'localhost'}`;
  return toResponse(UserResponse, {
    id: user._id.toString(),
    name: user.name,
    email: user.email,
    avatarPath: new URL(user.avatarPath || '/static/default-avatar.svg', origin).href,
    type: user.type,
  });
}

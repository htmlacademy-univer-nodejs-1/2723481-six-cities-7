import {inject, injectable} from 'inversify';
import {Model} from 'mongoose';
import {CreateUserDto} from './dto/create-user.dto.js';
import {UpdateUserDto} from './dto/update-user.dto.js';
import {UploadAvatarDto} from './dto/upload-avatar.dto.js';
import {Component} from '../../types/component.enum.js';
import {UserDocument, UserEntity} from './user.entity.js';
import {UserService} from './user-service.interface.js';
import {hashPassword} from './hash-password.js';

@injectable()
export class DefaultUserService implements UserService {
  constructor(@inject(Component.UserModel) private readonly model: Model<UserEntity>) {}

  public async create(user: CreateUserDto, salt: string): Promise<UserDocument> {
    if (!salt.trim()) {
      throw new Error('Соль для хеширования паролей не должна быть пустой.');
    }

    const password = (await hashPassword(user.password, salt)).toString('hex');
    return this.model.create({...user, favoriteOffers: [], password});
  }

  public async updateById(id: string, dto: UpdateUserDto): Promise<UserDocument | null> {
    return this.model.findByIdAndUpdate(id, {$set: dto}, {new: true}).exec();
  }

  public async findById(id: string): Promise<UserDocument | null> {
    return this.model.findById(id).exec();
  }

  public async findByEmail(email: string): Promise<UserDocument | null> {
    return this.model.findOne({email: {$eq: email}}).exec();
  }

  public async findAvatarById(id: string): Promise<UploadAvatarDto | undefined> {
    const user = await this.model.findById(id).select('avatar').exec();
    return user?.avatar;
  }
}

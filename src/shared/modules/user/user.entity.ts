import {HydratedDocument, model, Schema, Types} from 'mongoose';
import {User} from '../../../types/user.type.js';
import {UploadAvatarDto} from './dto/upload-avatar.dto.js';

export type UserEntity = User & {
  favoriteOffers: Types.ObjectId[];
  avatar?: UploadAvatarDto;
  createdAt: Date;
  updatedAt: Date;
};
export type UserDocument = HydratedDocument<UserEntity>;

const avatarSchema = new Schema<UploadAvatarDto>({
  contentType: String,
  data: Buffer,
}, {_id: false});

const userSchema = new Schema<UserEntity>({
  name: {type: String, required: true},
  email: {type: String, required: true, unique: true},
  avatarPath: String,
  avatar: {type: avatarSchema, select: false},
  password: {type: String, required: true},
  type: {type: String, required: true},
  favoriteOffers: [{type: Schema.Types.ObjectId, ref: 'Offer'}],
}, {collection: 'users', timestamps: true});

export const UserModel = model<UserEntity>('User', userSchema);

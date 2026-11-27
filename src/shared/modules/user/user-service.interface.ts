import {CreateUserDto} from './dto/create-user.dto.js';
import {UpdateUserDto} from './dto/update-user.dto.js';
import {UploadAvatarDto} from './dto/upload-avatar.dto.js';
import {UserDocument} from './user.entity.js';

export interface UserService {
  create(user: CreateUserDto, salt: string): Promise<UserDocument>;
  updateById(id: string, dto: UpdateUserDto): Promise<UserDocument | null>;
  findById(id: string): Promise<UserDocument | null>;
  findByEmail(email: string): Promise<UserDocument | null>;
  findAvatarById(id: string): Promise<UploadAvatarDto | undefined>;
}

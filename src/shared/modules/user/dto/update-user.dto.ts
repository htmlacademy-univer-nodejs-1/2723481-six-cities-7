import {User} from '../../../../types/user.type.js';
import {UploadAvatarDto} from './upload-avatar.dto.js';

export type UpdateUserDto = Pick<User, 'avatarPath'> & {avatar?: UploadAvatarDto};

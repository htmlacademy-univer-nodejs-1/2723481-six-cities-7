import {CreateUserDto} from './create-user.dto.js';

export type LoginUserDto = Pick<CreateUserDto, 'email' | 'password'>;

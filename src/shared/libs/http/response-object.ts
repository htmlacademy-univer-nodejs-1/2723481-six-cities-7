import {ClassConstructor, plainToInstance} from 'class-transformer';

export function toResponse<T>(type: ClassConstructor<T>, source: object): T {
  return plainToInstance(type, source, {excludeExtraneousValues: true});
}

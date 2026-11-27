import {StatusCodes} from 'http-status-codes';
import {isObjectIdOrHexString} from 'mongoose';
import {HttpError} from './http-error.js';

export function readObjectId(value: string): string {
  if (!isObjectIdOrHexString(value)) {
    throw new HttpError(StatusCodes.BAD_REQUEST, 'Некорректный идентификатор.');
  }
  return value.toLowerCase();
}

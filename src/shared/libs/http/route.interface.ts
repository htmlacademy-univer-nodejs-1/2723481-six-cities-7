import {RequestHandler} from 'express';

export interface Route<Body> {
  method: 'get' | 'post' | 'patch' | 'delete' | 'put';
  path: string;
  handler: RequestHandler<Record<string, string>, unknown, Body>;
  middleware?: RequestHandler[];
}

import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {test} from 'node:test';
import mongoose from 'mongoose';
import {container} from '../dist/container.js';
import {Component} from '../dist/shared/types/component.enum.js';

const config = {PORT: 0, DB_HOST: '127.0.0.1', DB_PORT: 27017, DB_NAME: 'six-cities', SALT: 'test-salt'};
const credentials = {email: 'author@example.com', password: 'test-password'};
const location = {latitude: 48.85661, longitude: 2.351499};
const offerBody = {
  title: 'A place in Paris',
  description: 'Apartment near a metro station.',
  postDate: '2026-11-16T10:00:00.000Z',
  city: {name: 'Paris', location},
  previewImage: 'https://example.com/preview.jpg',
  images: Array(6).fill('https://example.com/image.jpg'),
  isPremium: true,
  type: 'apartment',
  rooms: 2,
  guests: 3,
  price: 150,
  facilities: ['Washer'],
  location,
};

async function startHttp(t, databaseClient) {
  container.snapshot();
  t.after(() => container.restore());
  container.rebind(Component.DatabaseClient).toConstantValue(databaseClient);
  container.rebind(Component.Config).toConstantValue({get: (key) => config[key]});
  const listener = await container.get(Component.Application).init();
  t.after(() => new Promise((resolve, reject) => {
    listener.close((error) => error ? reject(error) : resolve());
    listener.closeIdleConnections();
  }));

  const origin = `http://127.0.0.1:${listener.address().port}`;
  return async (path, status, {method = 'GET', token, json, body, headers = {}} = {}) => {
    if (token) {
      headers = {...headers, authorization: `Bearer ${token}`};
    }
    if (json !== undefined) {
      headers = {...headers, 'content-type': 'application/json'};
      body = JSON.stringify(json);
    }
    const response = await fetch(new URL(path, origin), {method, headers, body});
    assert.equal(response.status, status, `${method} ${path}`);
    if (response.headers.get('content-type')?.startsWith('application/json')) {
      return response.json();
    }
    return Buffer.from(await response.arrayBuffer());
  };
}

test('REST API returns JSON for malformed requests and rejected async handlers', async (t) => {
  const request = await startHttp(t, {connect: async () => {}, disconnect: async () => {}});
  const offers = container.get(Component.OfferService);
  const rejected = new Error('internal details');
  const errors = [];
  t.mock.method(offers, 'find', async () => { throw rejected; });
  t.mock.method(container.get(Component.Logger), 'error', (message, error) => errors.push({message, error}));

  assert.equal(typeof (await request('/users/login', 400, {
    method: 'POST',
    body: '{',
    headers: {'content-type': 'application/json'},
  })).message, 'string');
  assert.equal(typeof (await request('/unknown', 404)).message, 'string');
  assert.equal(typeof (await request('/offers', 401, {token: 'invalid'})).message, 'string');
  assert.deepEqual(await request('/offers', 500), {message: 'Внутренняя ошибка сервера.'});
  assert.equal(errors.length, 1);
  assert.equal(errors[0].error, rejected);
});

test('REST API handles users, offers, favorites and multipart avatars with MongoDB', {
  skip: !process.env.TEST_MONGO_URI && 'Задайте TEST_MONGO_URI для интеграционной проверки MongoDB.',
  timeout: 30000,
}, async (t) => {
  const database = `six_cities_http_${process.pid}_${Date.now()}`;
  const uri = new URL(process.env.TEST_MONGO_URI);
  uri.pathname = `/${database}`;
  const client = container.get(Component.DatabaseClient);
  t.after(async () => {
    try {
      if (mongoose.connection.name === database) {
        await mongoose.connection.dropDatabase();
      }
    } finally {
      await client.disconnect();
    }
  });
  const request = await startHttp(t, {connect: () => client.connect(uri.href), disconnect: () => client.disconnect()});

  const register = {method: 'POST', json: {name: 'Author', type: 'regular', ...credentials}};
  const user = await request('/users/register', 201, register);
  assert.deepEqual(Object.keys(user).sort(), ['avatarPath', 'email', 'id', 'name', 'type']);
  assert.ok((await request(user.avatarPath, 200)).length > 0);
  await request('/users/register', 409, register);
  await request('/users/login', 401, {method: 'POST', json: {...credentials, password: 'wrong'}});

  const {token} = await request('/users/login', 200, {method: 'POST', json: credentials});
  assert.equal(token.split('.').length, 3);
  assert.deepEqual(await request('/users/login', 200, {token}), user);
  await request('/users/register', 403, {...register, token});

  const visitor = {...credentials, email: 'visitor@example.com'};
  await request('/users/register', 201, {method: 'POST', json: {...register.json, ...visitor}});
  const {token: visitorToken} = await request('/users/login', 200, {method: 'POST', json: visitor});
  const offer = await request('/offers', 201, {method: 'POST', token, json: {...offerBody, rating: 5}});
  const offerPath = `/offers/${offer.id}`;
  assert.deepEqual(offer, {...offerBody, id: offer.id, author: user, isFavorite: false, rating: 0, commentsCount: 0});
  assert.deepEqual(await request(offerPath, 200), offer);
  assert.deepEqual(await request('/offers?limit=1', 200), await request('/cities/Paris/premium', 200));
  const [summary] = await request('/offers', 200);
  assert.equal(summary.id, offer.id);
  assert.equal(summary.author, undefined);
  assert.equal(summary.description, undefined);
  await request('/offers/not-an-id', 400);
  await request(offerPath, 403, {method: 'PATCH', token: visitorToken, json: {price: 160}});

  const favoritePath = `/favorites/${offer.id}`;
  for (let attempt = 0; attempt < 2; attempt++) {
    assert.equal((await request(favoritePath, 200, {method: 'PUT', token})).isFavorite, true);
  }
  assert.equal((await request('/favorites', 200, {token})).length, 1);
  assert.deepEqual(await request('/favorites', 200, {token: visitorToken}), []);
  assert.deepEqual(await request(offerPath, 200, {
    method: 'PATCH', token, json: {price: 180, isFavorite: false, rating: 5},
  }), {...offer, price: 180, isFavorite: true});
  for (let attempt = 0; attempt < 2; attempt++) {
    assert.equal((await request(favoritePath, 204, {method: 'DELETE', token})).length, 0);
  }
  assert.deepEqual(await request('/favorites', 200, {token}), []);

  const avatarPath = `/users/${user.id}/avatar`;
  const jpeg = await readFile(new URL('../markup/img/apartment-01.jpg', import.meta.url));
  const form = new FormData();
  form.set('avatar', new Blob([jpeg], {type: 'image/jpeg'}), 'avatar.jpg');
  await request(avatarPath, 403, {method: 'POST', token: visitorToken, body: form});
  const updatedUser = await request(avatarPath, 200, {method: 'POST', token, body: form});
  assert.deepEqual(await request(updatedUser.avatarPath, 200), jpeg);
  assert.deepEqual(await request('/users/login', 200, {token}), updatedUser);

  assert.equal((await request(offerPath, 204, {method: 'DELETE', token})).length, 0);
  await request(offerPath, 404);
});

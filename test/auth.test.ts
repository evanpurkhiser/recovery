import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createBasicAuthorizationChallenge,
  parseBasicAuthorization,
} from '../src/worker/auth.ts';

const basic = (credentials: string) =>
  `Basic ${Buffer.from(credentials, 'utf8').toString('base64')}`;

test('prevents authorization challenges from being cached', () => {
  const response = createBasicAuthorizationChallenge();

  assert.equal(response.status, 401);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.equal(
    response.headers.get('www-authenticate'),
    'Basic realm="Recovery", charset="UTF-8"',
  );
});

test('reports a missing authorization header', () => {
  assert.deepEqual(parseBasicAuthorization(null), {status: 'missing'});
});

test('preserves colons in the passphrase', () => {
  assert.deepEqual(parseBasicAuthorization(basic('evan:first:second')), {
    status: 'credentials',
    username: 'evan',
    passphrase: 'first:second',
  });
});

test('decodes UTF-8 credentials', () => {
  assert.deepEqual(parseBasicAuthorization(basic('évàn:pāss🔐')), {
    status: 'credentials',
    username: 'évàn',
    passphrase: 'pāss🔐',
  });
});

test('rejects malformed authorization headers', () => {
  const invalidUtf8 = `Basic ${Buffer.from([0x65, 0x3a, 0xff]).toString('base64')}`;

  for (const header of [
    'Bearer token',
    'Basic !!!',
    'Basic ZQ===',
    basic('missing-separator'),
    invalidUtf8,
  ]) {
    assert.deepEqual(parseBasicAuthorization(header), {status: 'malformed'});
  }
});

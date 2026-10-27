const decoder = new TextDecoder('utf-8', {fatal: true, ignoreBOM: false});

export type BasicAuthorization =
  | {status: 'missing'}
  | {status: 'malformed'}
  | {status: 'credentials'; username: string; passphrase: string};

export function createBasicAuthorizationChallenge() {
  return new Response('Authorization Required', {
    status: 401,
    headers: {
      'Cache-Control': 'no-store',
      'WWW-Authenticate': 'Basic realm="Recovery", charset="UTF-8"',
    },
  });
}

export function parseBasicAuthorization(header: string | null): BasicAuthorization {
  if (header === null) {
    return {status: 'missing'};
  }

  const match = /^Basic +([A-Za-z0-9+/]+={0,2}) *$/i.exec(header);
  if (match === null) {
    return {status: 'malformed'};
  }

  const [, base64Auth] = match;

  try {
    // atob() returns a binary string whose characters represent individual
    // bytes, so convert those bytes before decoding the credentials as UTF-8.
    const bytes = Uint8Array.from(atob(base64Auth), character => character.charCodeAt(0));
    const credentials = decoder.decode(bytes);
    const separator = credentials.indexOf(':');

    if (separator === -1) {
      return {status: 'malformed'};
    }

    return {
      status: 'credentials',
      username: credentials.slice(0, separator),
      passphrase: credentials.slice(separator + 1),
    };
  } catch {
    return {status: 'malformed'};
  }
}

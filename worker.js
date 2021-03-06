/**
 * Cloudflare environment variables
 *
 * - USERNAME - The username to authenticate as
 * - ENCRYPTED_WEBSITE - The content output from `compile.mjs`
 * - TELEGRAM_TOKEN - The telgram bot token to use for access notifications
 * - TELEGRAM_CHAT_ID - The chat ID to post notifications into
 */

// Cloudflare webworkers only support 100k iterations.
const encryptionIterations = 100_000;

const encoder = new TextEncoder();

const base64ToBuffer = b64 => Uint8Array.from(atob(b64), c => c.charCodeAt(null));

const deriveKey = (passwordKey, salt, keyUsage) =>
  crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt,
      iterations: encryptionIterations,
      hash: 'SHA-256',
    },
    passwordKey,
    {name: 'AES-GCM', length: 256},
    false,
    keyUsage
  );

const getPasswordKey = password =>
  crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, [
    'deriveKey',
  ]);

async function decryptData(encryptedData, password) {
  const encryptedDataBuff = base64ToBuffer(encryptedData);
  const salt = encryptedDataBuff.slice(0, 16);
  const iv = encryptedDataBuff.slice(16, 16 + 12);
  const data = encryptedDataBuff.slice(16 + 12);
  const passwordKey = await getPasswordKey(password);
  const aesKey = await deriveKey(passwordKey, salt, ['decrypt']);
  const decryptedContent = await crypto.subtle.decrypt(
    {name: 'AES-GCM', iv},
    aesKey,
    data
  );
  return decryptedContent;
}

function reauthorize() {
  const response = new Response('Authorization Required', {status: 401});
  response.headers.set('WWW-Authenticate', 'Basic');

  return response;
}

function notifyTelegram(text) {
  const token = TELEGRAM_TOKEN;
  const chatId = TELEGRAM_CHAT_ID;

  const params = new URLSearchParams({
    text,
    chat_id: chatId,
    parse_mode: 'MarkdownV2',
  });

  try {
    return fetch(`https://api.telegram.org/bot${token}/sendMessage?${params.toString()}`);
  } catch {}
}

async function handleRequest(request) {
  // No authorization passed, request authorization
  if (!request.headers.has('authorization')) {
    return reauthorize();
  }

  const authorization = request.headers.get('authorization');

  // Extract the username and password from the authorization header
  var [username, passphrase] = atob(authorization.split(' ')[1]).split(':');

  // Invalid username
  if (username !== USERNAME) {
    await notifyTelegram('*Recovery Website:* Invalid username attempt');
    return reauthorize();
  }

  // Attempt to decode the website with the provided passphrase
  try {
    const html = await decryptData(ENCRYPTED_WEBSITE, passphrase);
    const headers = new Headers([
      ['Content-Encoding', 'gzip'],
      ['Content-Type', 'text/html'],
      ['Cache-Control', 'no-store'],
    ]);

    await notifyTelegram('*Recovery Website:* ACCESS GRANTED');

    return new Response(html, {status: 200, headers, encodeBody: 'manual'});
  } catch {}

  await notifyTelegram('*Recovery Website:* Invalid password attempt');

  return reauthorize();
}

addEventListener('fetch', event => event.respondWith(handleRequest(event.request)));

import util from 'node:util';
import {exec} from 'node:child_process';
import {promises as fs} from 'node:fs';
import {webcrypto as crypto} from 'node:crypto';

import showdown from 'showdown';
import {minify} from 'html-minifier-terser';

const asyncExec = util.promisify(exec);

/**
 * The 1Password ID of the recovery website
 */
const RECOVERY_ITEM_ID = '4bd2tue2hzqyokai2jaxpeypse';

/**
 * Options for converting the markdown to HTML
 */
const showdownOptions = {
  simpleLineBreaks: true,
};

/**
 * Options used to minify the HTML
 */
const minifyOptions = {
  minifyCSS: true,
  includeAutoGeneratedTags: true,
  removeAttributeQuotes: true,
  removeComments: true,
  removeRedundantAttributes: true,
  removeScriptTypeAttributes: true,
  removeStyleLinkTypeAttributes: true,
  sortClassName: true,
  useShortDoctype: true,
  collapseWhitespace: true,
};

// Cloudflare webworkers only support 100k iterations.
const encryptionIterations = 100_000;

const encoder = new TextEncoder();

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

async function encryptData(secretData, password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const passwordKey = await getPasswordKey(password);
  const aesKey = await deriveKey(passwordKey, salt, ['encrypt']);
  const encryptedContent = await crypto.subtle.encrypt(
    {name: 'AES-GCM', iv},
    aesKey,
    encoder.encode(secretData)
  );

  const encryptedContentArr = new Uint8Array(encryptedContent);

  // Pack the encrypted data with the salt and iv
  let buff = new Uint8Array(
    salt.byteLength + iv.byteLength + encryptedContentArr.byteLength
  );
  buff.set(salt, 0);
  buff.set(iv, salt.byteLength);
  buff.set(encryptedContentArr, salt.byteLength + iv.byteLength);

  return btoa(String.fromCharCode.apply(null, buff));
}

async function main() {
  try {
    await asyncExec('op vault list');
  } catch {
    console.error('Authenticate with the onepassword CLI `op signin`');
    return;
  }

  const result = await asyncExec(`op item get ${RECOVERY_ITEM_ID} --format=json`);
  const item = JSON.parse(result.stdout);

  // Get the markdown document and passphrase from the item
  const md = item.fields.find(field => field.label === 'notesPlain').value;
  const passphrase = item.fields.find(field => field.label === 'decryption key').value;

  // Convert markdown to HTML
  const conv = new showdown.Converter(showdownOptions);
  const mdHtml = conv.makeHtml(md);

  const css = fs.readFile('styles.css', 'utf8');

  const template = `
    <!DOCTYPE html>
    <html>
      <head>
        <title>Evan's Recovery</title>
        <style>${css}</style>
      </head>
      <body>${mdHtml}</body>
    </html>`;

  // Minify the HTML
  const html = await minify(template, minifyOptions);

  // Encrypt the HTML using the passphrase
  const encryptedHtml = await encryptData(html, passphrase);

  console.log(encryptedHtml);
}

main();

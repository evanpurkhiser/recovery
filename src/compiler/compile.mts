import {minify, type Options} from 'html-minifier-terser';
import {exec} from 'node:child_process';
import {webcrypto as crypto} from 'node:crypto';
import {promises as fs} from 'node:fs';
import {resolve} from 'node:path';
import {promisify} from 'node:util';
import {gzip} from 'node-gzip';
import showdown from 'showdown';

const asyncExec = promisify(exec);

/**
 * The 1Password ID of the recovery website
 */
const RECOVERY_ITEM_ID = '4bd2tue2hzqyokai2jaxpeypse';

/**
 * Options for converting the markdown to HTML
 */
const showdownOptions: showdown.ConverterOptions = {
  openLinksInNewWindow: true,
};

/**
 * Options used to minify the HTML
 */
const minifyOptions: Options = {
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

/**
 * Derives a cryptographic key from a password using PBKDF2
 */
const deriveKey = (passwordKey: CryptoKey, salt: Uint8Array, keyUsage: KeyUsage[]) =>
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

/**
 * Imports a password as a raw key for PBKDF2 derivation
 */
const getPasswordKey = (password: string) =>
  crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, [
    'deriveKey',
  ]);

/**
 * Encrypts data using AES-GCM with a password-derived key
 */
async function encryptData(secretData: Uint8Array, password: string) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const passwordKey = await getPasswordKey(password);
  const aesKey = await deriveKey(passwordKey, salt, ['encrypt']);
  const encryptedContent = await crypto.subtle.encrypt(
    {name: 'AES-GCM', iv},
    aesKey,
    secretData
  );

  const encryptedContentArr = new Uint8Array(encryptedContent);

  // Pack the encrypted data with the salt and iv
  const buff = new Uint8Array(
    salt.byteLength + iv.byteLength + encryptedContentArr.byteLength
  );
  buff.set(salt, 0);
  buff.set(iv, salt.byteLength);
  buff.set(encryptedContentArr, salt.byteLength + iv.byteLength);

  return btoa(String.fromCharCode.apply(null, buff));
}

async function main() {
  const result = await asyncExec(`op item get ${RECOVERY_ITEM_ID} --format=json`);
  const item = JSON.parse(result.stdout) as {
    fields: Array<{label: string; value: string}>;
  };

  // Get the markdown document and passphrase from the item
  const md = item.fields.find(field => field.label === 'notesPlain')?.value;
  const passphrase = item.fields.find(field => field.label === 'decryption key')?.value;

  if (!md || !passphrase) {
    throw new Error('Missing required fields from 1Password item');
  }

  // Convert markdown to HTML
  const conv = new showdown.Converter(showdownOptions);
  const mdHtml = conv.makeHtml(md);

  const css = await fs.readFile(resolve('src/compiler/styles.css'), 'utf8');

  const template = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8" />
        <link rel="icon" href="data:;base64,=">
        <title>Evan's Recovery</title>
        <style>${css}</style>
      </head>
      <body>${mdHtml}</body>
    </html>`;

  // Minify the HTML
  const html = await minify(template, minifyOptions);
  const gzHtml = await gzip(html);

  // Encrypt the HTML using the passphrase
  const encryptedHtml = await encryptData(gzHtml, passphrase);

  // Avoid newline in pbcopy
  process.stdout.write(encryptedHtml);
}

main();

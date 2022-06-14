## Evan's Personal Recovery website

It can be a tad scary having your entire digital life locked securely away in
something like 1Password, where if you were to lose access to all your devices,
you may lose access to EVERYTHING.

The tools in this repository provide me with a static password protected
"recovery" website that is hosted via Cloudflare Workers, which will help me in
the event that I lose access to all my digital devices.

Hopefully I'll never have to access this website. But it's there for a disaster
scenario.

### How does this work?

- I store a markdown document inside my 1Password that contains various
  details about how to recover my digital life, along with some important
  contacts should I need to immediately contact someone.

- The `compile.mjs` script extracts the markdown document from the secure
  Note in 1Password along with an additional passphrase from the Secure Note.
  It then encrypts this document using AES encryption and base64s the content
  and writes it to stdout.

  This comiler also handles converting the markdown document to HTML + CSS.

- A `worker.js` file is uploaded to a [Cloudflare
  Worker](https://workers.cloudflare.com/), which is given 2 important
  environment variables

  `USERNAME`: This is the username that is used for authentication.  
  `ENCRYPTED_WEBSITE`: This is the result of `compile.mjs`.

  When the worker is invoked, the provided password is used to attempt to
  decrypt the `ENCRYPTED_WEBSITE` content. If successful, the website is rendered.

### How to use this

1. Ensure the `RECOVERY_ITEM_ID` matches the Secure Note in 1Password
   containing the markdown file.

2. Deploy the `worker.js` to cloudflare.

3. Run `make` and set the environment variables as described above.

SHELL=/bin/bash -o pipefail

.PHONY: build
.PHONY: dev

deploy:
	pnpm exec wrangler secret put ENCRYPTED_WEBSITE < <(node src/compiler/compile.mts)
	pnpm exec wrangler secret put USERNAME < <(op item get 4bd2tue2hzqyokai2jaxpeypse --field="username")
	pnpm exec wrangler secret put TELEGRAM_TOKEN < <(op item get wddknbssdbdpbilpy25olziegm --reveal --field="Purkhiser Bot")
	pnpm exec wrangler deploy

dev:
	pnpm exec wrangler dev

SHELL=/bin/bash -o pipefail

.PHONY: build
.PHONY: dev

deploy:
	yarn wrangler secret put ENCRYPTED_WEBSITE < <(node src/compiler/compile.mts)
	yarn wrangler secret put USERNAME < <(op item get 4bd2tue2hzqyokai2jaxpeypse --field="username")
	yarn wrangler secret put TELEGRAM_TOKEN < <(op item get wddknbssdbdpbilpy25olziegm --reveal --field="Purkhiser Bot")
	yarn wrangler deploy

dev:
	yarn wrangler dev

.PHONY: build

build:
	node compile.mjs | pbcopy
	@echo "Encrypted website has been added to the clipboard"
	@echo "Create a ENCRYPTED_WEBSITE key in the Cloudflare Worker"

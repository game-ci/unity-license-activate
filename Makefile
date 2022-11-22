NODE ?= node
ENTRY ?= lib/cli.js

ALF ?= test/fixtures/Unity_v2021.1.1f1.alf

.PHONY: test

test:
	@echo "Testing..."
	$(NODE)	$(ENTRY) test.email@gmail.com @pass $(ALF)

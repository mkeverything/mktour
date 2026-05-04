---
name: mobile-dev
description: configure mobile development environment
disable-model-invocation: true
---

# mobile dev setup

set up your mobile development environment to be accessible via local network.

## what this does

1. detects your local ip address (192.168.x.x)
2. updates `src/lib/config/urls.ts` with your local ip
3. updates `next.config.mjs` to allow dev connections from your local IP
4. confirms the setup with the accessible URL

## usage

run the setup script: `scripts/setup-mobile-dev.sh`

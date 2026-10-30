---
name: mobile-dev
description: configure local network access for mobile development and testing on a physical device
disable-model-invocation: true
---

# mobile dev setup

set up your mobile development environment to be accessible via local network.

## what this does

1. detects your local ip address (192.168.x.x)
2. updates `src/lib/config/urls.ts` with your local ip
3. updates `next.config.mjs` to allow dev connections from your local ip
4. confirms the setup with the accessible url

## usage

from the repository root, run `bash .agents/skills/mobile-dev/scripts/setup-mobile-dev.sh`.

the shared skill lives in `.agents/skills/mobile-dev/`; cursor and claude use links to the same directory.

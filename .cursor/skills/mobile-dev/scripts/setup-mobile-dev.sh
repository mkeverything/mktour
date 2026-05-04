#!/bin/bash
set -e

# step 1: get local ip
localIp=$(ifconfig | grep 'inet ' | grep -v '127.0.0.1' | awk '{print $2}' | grep '^192\.168\.' | head -n 1)

if [ -z "$localIp" ]; then
  echo "error: no 192.168.x.x ip address found"
  exit 1
fi

echo "detected local ip: $localIp"

# step 2: update src/lib/config/urls.ts
sed -i "" "s/localhost/$localIp/g" src/lib/config/urls.ts

# step 3: update next.config.mjs
if grep -q "allowedDevOrigins" next.config.mjs; then
  sed -i "" "s/allowedDevOrigins: \[.*\]/allowedDevOrigins: [\"$localIp\"]/g" next.config.mjs
else
  sed -i "" "/nextConfig = {/a\\
  allowedDevOrigins: [\"$localIp\"],
" next.config.mjs
fi

# step 4: show confirmation
echo "setup complete!"
echo "http://$localIp:3000 is now accessible via local network"
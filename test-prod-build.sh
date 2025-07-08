#!/bin/bash

echo "🏗️  Testing TaskPilot Production Build"
echo "======================================"

echo "📦 Building server..."
bun run build:server

echo "📦 Building UI..."
bun run build:ui

echo "🚀 Testing production server..."
timeout 10s bun run serve &
SERVER_PID=$!

sleep 3

echo -n "✅ Production Server Health: "
curl -s http://localhost:8989/health | jq -r '.status' || echo "❌ Failed"

echo -n "✅ Static UI Serving: "
UI_RESULT=$(curl -s -I http://localhost:8989 | head -1)
if echo "$UI_RESULT" | grep -q "200"; then
  echo "✅ OK"
else
  echo "❌ Failed"
fi

# Cleanup
kill $SERVER_PID 2>/dev/null

echo ""
echo "🎉 Production build test complete!"

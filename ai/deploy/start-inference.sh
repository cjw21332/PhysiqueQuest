#!/bin/sh
set -eu
rm -f /tmp/phiq-ready
ollama serve &
server_pid=$!
trap 'kill "$server_pid" 2>/dev/null || true' INT TERM EXIT
export OLLAMA_HOST=http://127.0.0.1:11434
attempt=0
until curl -fsS "$OLLAMA_HOST/api/version" > /dev/null; do
  attempt=$((attempt + 1))
  if [ "$attempt" -gt 120 ]; then echo 'Private inference did not start.' >&2; exit 1; fi
  kill -0 "$server_pid"
  sleep 1
done
# Public weights are downloaded once into the persistent model volume. No user data.
ollama pull qwen3.5:4b
ollama create physiquequest-phiq -f /opt/phiq/Modelfile
curl --fail --silent --show-error --max-time 300 "$OLLAMA_HOST/api/chat" \
  -H 'Content-Type: application/json' \
  -d '{"model":"physiquequest-phiq","messages":[],"stream":false,"think":false,"keep_alive":"30m","options":{"num_ctx":8192,"num_predict":1}}' > /dev/null
touch /tmp/phiq-ready
echo 'Private Phiq model ready.'
wait "$server_pid"

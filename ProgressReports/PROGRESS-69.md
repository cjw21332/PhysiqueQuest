# Progress 69 — Repeatable phone startup

Date: 2026-11-16

Added `scripts/start-phone.ps1` to start MongoDB when needed, build the backend, run isolated backend, Coach and web services, and create a temporary HTTPS tunnel for phones outside the local network. Repeated runs reuse a healthy session; a stopped managed web service was tested and the same command recovered the session with a new tunnel. The public readiness endpoint and an authentication preflight returned successful responses. The phone's cellular connection was not active during verification, so a physical cellular-network test remains outstanding. Quick tunnel addresses can change after restart and are not a permanent deployed address.

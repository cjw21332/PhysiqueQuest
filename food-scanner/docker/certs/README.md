# TLS certificates

This directory is intentionally empty. Nothing here is committed.

## Enabling the TLS listener

1. Obtain a certificate for the hostname the main backend uses to reach this
   service. Place two files here:
   - `fullchain.pem` — the certificate plus its intermediate chain
   - `privkey.pem`   — the private key, mode `0600`, owned by root

2. Uncomment the `include /etc/nginx/conf.d/tls.conf;` line at the bottom of
   `docker/nginx.conf`.

3. Uncomment the matching `volumes` and `ports` entries in `docker-compose.yml`.

4. Copy the same allowlist rules into `tls.conf`, or point its include at the
   shared `allowlist.conf`.

5. Restart: `docker compose up -d`

## On Render

A Render Web Service already terminates TLS for its public hostname and forwards
plain HTTP to `$PORT` inside the container. Enabling the nginx TLS listener on
Render is therefore only useful for a *second*, direct ingress from the main
backend - for example when the main backend calls the service over the private
network rather than through Render's edge.

## Notes

- Certificate renewal is not automated here. Use certbot with a `--deploy-hook`
  that runs `docker compose exec proxy nginx -s reload`, or move renewal to
  whatever terminates TLS in your platform.
- Keys must never be committed. `.gitignore` does not currently cover this
  directory; add `docker/certs/` before the first commit.

# API schema

Run `npm run docs:export` from `backend`. It builds with the pinned
`@nestjs/swagger@12.0.2` CLI plugin, then writes `backend/openapi.json` without
connecting to MongoDB. DTO schemas and validation constraints come from the
existing DTOs. Explicit metadata covers session responses and forbidden request
fields that TypeScript cannot represent in OpenAPI.

The generated file is ignored by Git. The backend CI workflow exports it and
uploads an `openapi` artifact for frontend/mobile consumers. Regenerate after
changing a DTO or route.

Interactive documentation is available at `/docs`, with JSON at
`/docs/openapi.json`, only when `SWAGGER_ENABLED=true` and `NODE_ENV` is
`development` or `test` (unset defaults to development). Both routes remain
disabled in production, even if the flag is true. Other environment names are
also disabled; there is no unauthenticated staging override.

The document describes bearer access authentication, the `pq_refresh` httpOnly
cookie rotation flow, and the common error envelope. Swagger authorization is
not persisted in browser storage. Do not paste production credentials into a
development documentation instance.

Verification: `npm test -- src/openapi.spec.ts` checks development 200,
production 404, both JSON/UI routes, and the error/security schema. The export
script asserts DTO property discovery and required security/error components.

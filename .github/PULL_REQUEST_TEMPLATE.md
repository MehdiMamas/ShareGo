## Summary

<!-- What does this PR do and why? -->

## Changes

<!-- List the key changes -->

-

## Platforms Affected

- [ ] Core library (`core/`)
- [ ] Desktop (macOS / Windows / Linux)
- [ ] Mobile (Android / iOS)
- [ ] Documentation (`docs/`)
- [ ] CI / build scripts

## Checklist

- [ ] I have read [CONTRIBUTING.md](docs/CONTRIBUTING.md)
- [ ] Type check passes: `cd core && npx tsc --noEmit`
- [ ] Tests pass: `npm run test:core`
- [ ] UI parity: changes applied to both desktop and mobile (if applicable)
- [ ] User-facing text added to `core/src/i18n/en.ts` (not hardcoded)
- [ ] Config values from `core/src/config.ts` (not hardcoded)
- [ ] Documentation updated (if protocol, architecture, or security changed)

## Security Checklist (if touching `core/`)

- [ ] No secrets or keys are persisted to disk
- [ ] Ephemeral keys are zeroed on session end (`zeroMemory()`)
- [ ] No new dependencies introduced without justification
- [ ] No cloud or internet fallback added
- [ ] Encryption uses libsodium only — no platform crypto APIs
- [ ] No `console.log` of keys, secrets, or sensitive data
- [ ] Constant-time comparison for any secret comparison
- [ ] Sequence numbers validated (replay protection)
- [ ] THREAT_MODEL.md updated if security surface changed

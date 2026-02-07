## Summary

<!-- What does this PR do and why? -->

## Changes

<!-- List the key changes -->

-

## Platforms Affected

- [ ] Core library
- [ ] Desktop (macOS / Windows / Linux)
- [ ] Mobile (Android / iOS)

## Checklist

- [ ] I have read [CONTRIBUTING.md](docs/CONTRIBUTING.md)
- [ ] Type check passes: `cd core && npx tsc --noEmit`
- [ ] Tests pass: `cd core && npm test`
- [ ] UI parity: changes applied to both desktop and mobile (if applicable)
- [ ] Documentation updated (if protocol, architecture, or security changed)

## Security Checklist (if touching `core/`)

- [ ] No secrets or keys are persisted to disk
- [ ] Ephemeral keys are zeroed on session end
- [ ] No new dependencies introduced without justification
- [ ] No cloud or internet fallback added
- [ ] Encryption uses libsodium only

# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| latest  | :white_check_mark: |

## Reporting a Vulnerability

ShareGo takes security seriously. If you discover a security vulnerability, please report it responsibly.

**Do NOT open a public issue for security vulnerabilities.**

### How to report

1. Email: Send a detailed report to the repository owner via [GitHub private vulnerability reporting](https://github.com/MehdiMamas/ShareGo/security/advisories/new)
2. Include:
   - Description of the vulnerability
   - Steps to reproduce
   - Potential impact
   - Suggested fix (if any)

### What to expect

- Acknowledgment within 48 hours
- Status update within 7 days
- We aim to release a fix within 30 days for confirmed vulnerabilities

### Scope

The following are in scope for security reports:

- Cryptographic weaknesses in the key exchange or encryption
- Authentication or authorization bypass
- Data leakage (keys, plaintext, session data)
- Memory safety issues (key material not zeroed)
- Protocol-level attacks (replay, MITM, downgrade)
- Transport layer vulnerabilities

### Out of scope

- Denial of service on local network (inherent to local-network design)
- Physical access attacks
- Social engineering
- Issues in third-party dependencies (report upstream, but let us know)

## Security Architecture

ShareGo is designed with security as a primary goal:

- **No cloud servers** — all communication stays on local network
- **End-to-end encryption** — XChaCha20-Poly1305 (AEAD) via libsodium
- **Ephemeral keys** — fresh X25519 key pairs generated per session, never persisted
- **Memory zeroing** — key material is wiped from memory when sessions end
- **No data persistence** — nothing is written to disk

For full details, see [`docs/THREAT_MODEL.md`](docs/THREAT_MODEL.md).

# Protocol

Version 2. Two devices on the same LAN. The receiver listens. The sender connects. No server, no relay.

## Transport

TCP. Each frame is a 4-byte big-endian length, then a UTF-8 JSON body. A frame larger than 65536 bytes is rejected. The default listen port is 4040. If that port is taken, the receiver binds an ephemeral port and puts that port in the QR code and the mDNS record.

## Bootstrap

The receiver generates an X25519 key pair and a 6-character code from `ABCDEFGHJKLMNPQRSTUVWXYZ23456789`. It shows:

- the code
- `address`, its LAN IPv4 and port
- a QR code

```json
{"v":2,"code":"A7K3M2","addr":"192.168.1.10:4040","pk":"<32-byte public key, standard base64>"}
```

The QR code is only a bootstrap. It never contains the secret.

The receiver also advertises `_sharego._tcp` with the code in a TXT attribute. That record is only for finding the address. The sender does not trust a public key learned from mDNS.

The code and keys change every 30 seconds until a valid HELLO arrives. A wrong code is denied and the receiver keeps waiting. After a valid HELLO, the listener closes. A second connection is refused.

## Handshake

Plaintext JSON, then encrypted frames.

1. Sender sends HELLO: `{v, type:"HELLO", code, pk, deviceName}`.
2. Receiver checks the code. On a mismatch it sends `{v, type:"DENY", reason}` and keeps listening.
3. Receiver sends WELCOME: `{v, type:"WELCOME", pk}`.
4. If the sender scanned a QR code, it compares WELCOME's public key with the key in the QR code. A mismatch closes the connection.
5. Both sides derive keys from the X25519 shared secret and the exact HELLO and WELCOME bytes (see below).
6. Both screens show the same 6-digit verification number. The person at the receiver compares them and taps Approve or Reject.
7. Approve sends an encrypted ACCEPT. Reject sends an encrypted REJECT and both sides close.

The session then lasts at most 5 minutes. Approval itself times out after 60 seconds.

## Keys

```
shared = X25519(local private, remote public)
salt   = SHA-256(hello bytes || welcome bytes)
send/recv = HKDF-SHA256(shared, salt, info)
```

`info` is `sharego-v2-sender` or `sharego-v2-receiver`. The sender encrypts with the sender key and decrypts with the receiver key. The receiver does the opposite.

The verification number is the first 4 bytes of HKDF info `sharego-v2-verify`, as a big-endian integer modulo 1000000, printed as 6 digits. That key is wiped after the number is taken.

## Encrypted frames

After WELCOME, the only accepted frame is:

```json
{"v":2,"type":"ENC","seq":1,"nonce":"<24 bytes, base64>","ct":"<ciphertext || 16-byte poly1305 mac, base64>"}
```

The plaintext is JSON:

| type | fields | who |
| --- | --- | --- |
| ACCEPT | | receiver, once |
| REJECT | reason | receiver |
| DATA | text | either, after ACCEPT. text is 1 to 8000 characters |
| ACK | ackSeq | the peer, for that DATA seq |
| CLOSE | | either, then both wipe keys |

Encryption is XChaCha20-Poly1305. Each message uses a new 24-byte nonce. The sequence number is bound as 8-byte big-endian associated data. Each direction has its own counter, starting at 1. A frame whose seq is not the next expected value, or whose mac does not match, closes the session.

## Close

On CLOSE, timeout, or local end, both sides drop the socket and wipe the session keys. The messages stay in memory only until the screen is closed.

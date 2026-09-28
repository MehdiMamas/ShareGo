import 'dart:convert';
import 'dart:typed_data';

import 'package:cryptography/cryptography.dart';

final _x25519 = X25519();
final _aead = Xchacha20.poly1305Aead();
final _hkdf = Hkdf(hmac: Hmac.sha256(), outputLength: 32);

const _senderInfo = 'sharego-v2-sender';
const _receiverInfo = 'sharego-v2-receiver';
const _verifyInfo = 'sharego-v2-verify';

/// ephemeral x25519 identity. private bytes live inside [keys].
class Identity {
  Identity(this.keys, this.publicKey);

  final SimpleKeyPairData keys;
  final Uint8List publicKey;

  static Future<Identity> generate() async {
    final pair = await _x25519.newKeyPair();
    final data = await pair.extract();
    final publicKey = Uint8List.fromList(data.publicKey.bytes);
    if (!identical(pair, data)) {
      pair.destroy();
    }
    return Identity(data, publicKey);
  }

  void wipe() {
    keys.destroy();
    publicKey.fillRange(0, publicKey.length, 0);
  }
}

/// send and receive keys for one direction of the session.
class SessionKeys {
  SessionKeys({
    required this.send,
    required this.receive,
    required this.verificationCode,
  });

  final SecretKeyData send;
  final SecretKeyData receive;
  final String verificationCode;

  void wipe() {
    send.destroy();
    receive.destroy();
  }
}

class SealedBox {
  const SealedBox(this.nonce, this.cipherAndMac);

  final Uint8List nonce;
  final Uint8List cipherAndMac;
}

bool constantTimeEquals(List<int> a, List<int> b) {
  if (a.length != b.length) return false;
  var diff = 0;
  for (var i = 0; i < a.length; i++) {
    diff |= a[i] ^ b[i];
  }
  return diff == 0;
}

Uint8List seqAad(int seq) {
  final bytes = Uint8List(8);
  ByteData.sublistView(bytes).setUint64(0, seq);
  return bytes;
}

/// both sides pass the exact hello and welcome frame bytes they exchanged.
Future<SessionKeys> deriveSessionKeys({
  required SimpleKeyPairData local,
  required List<int> remotePublicKey,
  required List<int> helloBytes,
  required List<int> welcomeBytes,
  required bool iAmSender,
}) async {
  final shared = await _x25519.sharedSecretKey(
    keyPair: local,
    remotePublicKey: SimplePublicKey(
      remotePublicKey,
      type: KeyPairType.x25519,
    ),
  );
  // own the shared secret so destroy() overwrites it
  final sharedBytes = Uint8List.fromList(await shared.extractBytes());
  shared.destroy();
  final sharedKey = SecretKeyData(sharedBytes, overwriteWhenDestroyed: true);

  final transcript = Uint8List(helloBytes.length + welcomeBytes.length)
    ..setRange(0, helloBytes.length, helloBytes)
    ..setRange(helloBytes.length, helloBytes.length + welcomeBytes.length, welcomeBytes);
  final salt = (await Sha256().hash(transcript)).bytes;

  Future<SecretKeyData> derive(String info) async {
    final derived = await _hkdf.deriveKey(
      secretKey: sharedKey,
      nonce: salt,
      info: utf8.encode(info),
    );
    final bytes = Uint8List.fromList(await derived.extractBytes());
    derived.destroy();
    return SecretKeyData(bytes, overwriteWhenDestroyed: true);
  }

  final senderKey = await derive(_senderInfo);
  final receiverKey = await derive(_receiverInfo);
  final verifyKey = await derive(_verifyInfo);
  final number = ByteData.sublistView(
        Uint8List.fromList(verifyKey.bytes),
      ).getUint32(0) %
      1000000;
  verifyKey.destroy();
  sharedKey.destroy();

  final code = number.toString().padLeft(6, '0');
  if (iAmSender) {
    return SessionKeys(send: senderKey, receive: receiverKey, verificationCode: code);
  }
  return SessionKeys(send: receiverKey, receive: senderKey, verificationCode: code);
}

Future<SealedBox> seal({
  required SecretKey secretKey,
  required List<int> plain,
  required int seq,
}) async {
  final box = await _aead.encrypt(
    plain,
    secretKey: secretKey,
    aad: seqAad(seq),
  );
  return SealedBox(
    Uint8List.fromList(box.nonce),
    Uint8List.fromList([...box.cipherText, ...box.mac.bytes]),
  );
}

Future<List<int>> open({
  required SecretKey secretKey,
  required List<int> nonce,
  required List<int> cipherAndMac,
  required int seq,
}) {
  if (nonce.length != _aead.nonceLength || cipherAndMac.length <= _aead.macAlgorithm.macLength) {
    throw SecretBoxAuthenticationError();
  }
  final macLength = _aead.macAlgorithm.macLength;
  final split = cipherAndMac.length - macLength;
  final box = SecretBox(
    Uint8List.sublistView(Uint8List.fromList(cipherAndMac), 0, split),
    nonce: nonce,
    mac: Mac(Uint8List.sublistView(Uint8List.fromList(cipherAndMac), split)),
  );
  return _aead.decrypt(box, secretKey: secretKey, aad: seqAad(seq));
}

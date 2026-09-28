import 'dart:convert';
import 'dart:typed_data';

import 'package:cryptography/cryptography.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:sharego/core/crypto.dart';

void main() {
  test('both sides derive the same verification number and keys', () async {
    final alice = await Identity.generate();
    final bob = await Identity.generate();
    final hello = Uint8List.fromList(utf8.encode('hello-bytes'));
    final welcome = Uint8List.fromList(utf8.encode('welcome-bytes'));

    final aliceKeys = await deriveSessionKeys(
      local: alice.keys,
      remotePublicKey: bob.publicKey,
      helloBytes: hello,
      welcomeBytes: welcome,
      iAmSender: true,
    );
    final bobKeys = await deriveSessionKeys(
      local: bob.keys,
      remotePublicKey: alice.publicKey,
      helloBytes: hello,
      welcomeBytes: welcome,
      iAmSender: false,
    );

    expect(aliceKeys.verificationCode, bobKeys.verificationCode);
    expect(aliceKeys.verificationCode, hasLength(6));

    final sealed = await seal(
      secretKey: aliceKeys.send,
      plain: utf8.encode('hi'),
      seq: 1,
    );
    expect(sealed.nonce, hasLength(24));
    final opened = await open(
      secretKey: bobKeys.receive,
      nonce: sealed.nonce,
      cipherAndMac: sealed.cipherAndMac,
      seq: 1,
    );
    expect(utf8.decode(opened), 'hi');

    await expectLater(
      open(
        secretKey: bobKeys.receive,
        nonce: sealed.nonce,
        cipherAndMac: sealed.cipherAndMac,
        seq: 2,
      ),
      throwsA(isA<SecretBoxAuthenticationError>()),
    );

    final tampered = Uint8List.fromList(sealed.cipherAndMac);
    tampered[0] ^= 1;
    await expectLater(
      open(
        secretKey: bobKeys.receive,
        nonce: sealed.nonce,
        cipherAndMac: tampered,
        seq: 1,
      ),
      throwsA(isA<SecretBoxAuthenticationError>()),
    );

    aliceKeys.wipe();
    expect(aliceKeys.send.isDestroyed, isTrue);
    expect(() => aliceKeys.send.bytes, throwsStateError);

    bobKeys.wipe();
    alice.wipe();
    bob.wipe();
  });

  test('constant time compare rejects a different key', () {
    expect(constantTimeEquals([1, 2, 3], [1, 2, 3]), isTrue);
    expect(constantTimeEquals([1, 2, 3], [1, 2, 4]), isFalse);
    expect(constantTimeEquals([1], [1, 2]), isFalse);
  });
}

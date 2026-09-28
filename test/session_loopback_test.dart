import 'dart:convert';
import 'dart:io';

import 'package:flutter_test/flutter_test.dart';

import 'package:sharego/core/crypto.dart';
import 'package:sharego/core/protocol.dart';
import 'package:sharego/core/session.dart';

void main() {
  Future<void> until(bool Function() ready) async {
    final started = DateTime.now();
    while (!ready()) {
      if (DateTime.now().difference(started) > const Duration(seconds: 5)) {
        fail('timed out waiting for session');
      }
      await Future<void>.delayed(const Duration(milliseconds: 20));
    }
  }

  test('qr pin, approval, and encrypted messages', () async {
    final receiver = Session();
    final sender = Session();
    addTearDown(() async {
      await receiver.end();
      await sender.end();
      receiver.dispose();
      sender.dispose();
    });

    await receiver.startReceiver(deviceName: 'Receiver', advertiseHost: '127.0.0.1');
    final qr = QrPayload.tryParse(receiver.qrPayload!);
    expect(qr, isNotNull);
    expect(qr!.code, receiver.code);
    expect(qr.address, receiver.address);

    await sender.startSender(
      code: qr.code,
      address: qr.address,
      deviceName: 'Sender',
      pinnedPublicKey: qr.publicKey,
    );
    await until(() => receiver.phase == SessionPhase.pending && sender.phase == SessionPhase.pending);
    expect(receiver.verificationCode, sender.verificationCode);
    expect(receiver.peerName, 'Sender');

    await receiver.approve();
    await until(() => receiver.phase == SessionPhase.active && sender.phase == SessionPhase.active);

    expect(await sender.sendText('hunter2'), isTrue);
    await until(() => receiver.messages.any((message) => message.text == 'hunter2'));
    await until(() => sender.messages.single.delivered);

    expect(await receiver.sendText('ok'), isTrue);
    await until(() => sender.messages.any((message) => message.text == 'ok' && !message.outgoing));

    final port = receiver.port!;
    await expectLater(
      Socket.connect('127.0.0.1', port, timeout: const Duration(seconds: 2)),
      throwsA(isA<SocketException>()),
    );
  });

  test('a wrong code is denied and the receiver keeps waiting', () async {
    final receiver = Session();
    final sender = Session();
    addTearDown(() async {
      await receiver.end();
      await sender.end();
      receiver.dispose();
      sender.dispose();
    });

    await receiver.startReceiver(deviceName: 'Receiver', advertiseHost: '127.0.0.1');
    final wrong = receiver.code == 'AAAAAA' ? 'BBBBBB' : 'AAAAAA';
    await sender.startSender(
      code: wrong,
      address: receiver.address!,
      deviceName: 'Sender',
    );
    await until(() => sender.phase == SessionPhase.closed);
    expect(sender.error, SessionError.codeExpired);
    expect(receiver.phase, SessionPhase.waiting);
  });

  test('a pinned key that does not match closes the sender', () async {
    final receiver = Session();
    final sender = Session();
    addTearDown(() async {
      await receiver.end();
      await sender.end();
      receiver.dispose();
      sender.dispose();
    });

    await receiver.startReceiver(deviceName: 'Receiver', advertiseHost: '127.0.0.1');
    final other = await Identity.generate();
    addTearDown(other.wipe);
    await sender.startSender(
      code: receiver.code!,
      address: receiver.address!,
      deviceName: 'Sender',
      pinnedPublicKey: base64Encode(other.publicKey),
    );
    await until(() => sender.phase == SessionPhase.closed);
    expect(sender.error, SessionError.keyMismatch);
  });

  test('reject closes both sides', () async {
    final receiver = Session();
    final sender = Session();
    addTearDown(() async {
      await receiver.end();
      await sender.end();
      receiver.dispose();
      sender.dispose();
    });

    await receiver.startReceiver(deviceName: 'Receiver', advertiseHost: '127.0.0.1');
    await sender.startSender(
      code: receiver.code!,
      address: receiver.address!,
      deviceName: 'Sender',
    );
    await until(() => receiver.phase == SessionPhase.pending);
    await receiver.reject();
    await until(() => sender.phase == SessionPhase.closed && receiver.phase == SessionPhase.closed);
    expect(sender.error, SessionError.rejected);
    expect(receiver.error, SessionError.rejected);
  });

  test('the code changes when the bootstrap window ends', () async {
    final receiver = Session(bootstrapTtl: const Duration(milliseconds: 200));
    addTearDown(() async {
      await receiver.end();
      receiver.dispose();
    });
    await receiver.startReceiver(deviceName: 'Receiver', advertiseHost: '127.0.0.1');
    final first = receiver.code;
    await until(() => receiver.code != first);
    expect(receiver.phase, SessionPhase.waiting);
  });

  test('an active session closes when its lifetime ends', () async {
    final receiver = Session(sessionTtl: const Duration(milliseconds: 300));
    final sender = Session(sessionTtl: const Duration(seconds: 30));
    addTearDown(() async {
      await sender.end();
      await receiver.end();
      sender.dispose();
      receiver.dispose();
    });
    await receiver.startReceiver(deviceName: 'Receiver', advertiseHost: '127.0.0.1');
    await sender.startSender(
      code: receiver.code!,
      address: receiver.address!,
      deviceName: 'Sender',
    );
    await until(() => receiver.phase == SessionPhase.pending);
    await receiver.approve();
    await until(() => receiver.phase == SessionPhase.closed);
    expect(receiver.error, SessionError.timedOut);
    await until(() => sender.phase == SessionPhase.closed);
  });
}

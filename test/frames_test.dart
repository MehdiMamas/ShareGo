import 'dart:convert';
import 'dart:io';
import 'dart:typed_data';

import 'package:flutter_test/flutter_test.dart';

import 'package:sharego/config.dart';
import 'package:sharego/core/frames.dart';

void main() {
  test('frames reassemble split tcp chunks', () {
    final reader = FrameReader();
    final frame = encodeFrame(Uint8List.fromList(utf8.encode('{"a":1}')));
    expect(reader.add(Uint8List.sublistView(frame, 0, 3)), isEmpty);
    final rest = reader.add(Uint8List.sublistView(frame, 3));
    expect(utf8.decode(rest.single), '{"a":1}');
  });

  test('frames reject an oversized header', () {
    final reader = FrameReader();
    final header = Uint8List(4);
    ByteData.sublistView(header).setUint32(0, AppConfig.maxFrameSize + 1);
    expect(() => reader.add(header), throwsA(isA<FrameException>()));
  });

  test('a socket pair exchanges one frame', () async {
    final server = await ServerSocket.bind(InternetAddress.loopbackIPv4, 0);
    final client = await Socket.connect(InternetAddress.loopbackIPv4, server.port);
    final body = Uint8List.fromList(utf8.encode('{"ok":true}'));
    client.add(encodeFrame(body));
    await client.flush();
    final incoming = await server.first;
    final reader = FrameReader();
    final frames = <Uint8List>[];
    await for (final chunk in incoming) {
      frames.addAll(reader.add(chunk));
      if (frames.isNotEmpty) break;
    }
    expect(frames.single, body);
    client.destroy();
    incoming.destroy();
    await server.close();
  });
}

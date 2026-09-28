import 'dart:typed_data';

import '../config.dart';

class FrameException implements Exception {
  const FrameException(this.message);
  final String message;

  @override
  String toString() => message;
}

/// 4-byte big-endian length prefix, then the body.
Uint8List encodeFrame(Uint8List body) {
  if (body.isEmpty || body.length > AppConfig.maxFrameSize) {
    throw FrameException('frame is ${body.length} bytes');
  }
  final out = Uint8List(4 + body.length);
  ByteData.sublistView(out).setUint32(0, body.length);
  out.setRange(4, out.length, body);
  return out;
}

/// reassembles tcp chunks into frames.
class FrameReader {
  final BytesBuilder _pending = BytesBuilder(copy: false);

  List<Uint8List> add(Uint8List chunk) {
    _pending.add(chunk);
    final data = _pending.takeBytes();
    final frames = <Uint8List>[];
    var offset = 0;
    while (data.length - offset >= 4) {
      final length = ByteData.sublistView(data, offset, offset + 4).getUint32(0);
      if (length == 0 || length > AppConfig.maxFrameSize) {
        throw FrameException('frame is $length bytes');
      }
      if (data.length - offset < 4 + length) break;
      frames.add(Uint8List.fromList(data.sublist(offset + 4, offset + 4 + length)));
      offset += 4 + length;
    }
    if (offset < data.length) {
      _pending.add(Uint8List.sublistView(data, offset));
    }
    return frames;
  }
}

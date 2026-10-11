import 'package:flutter_test/flutter_test.dart';
import 'package:sharego/core/updates.dart';

void main() {
  test('isNewer compares dotted versions', () {
    expect(isNewer('2.0.2', '2.0.1'), isTrue);
    expect(isNewer('2.1.0', '2.0.9'), isTrue);
    expect(isNewer('10.0.0', '9.9.9'), isTrue);
    expect(isNewer('2.0.1', '2.0.1'), isFalse);
    expect(isNewer('2.0.0', '2.0.1'), isFalse);
    expect(isNewer('2.0.1+40', '2.0.1'), isFalse);
    expect(isNewer('2.0.1.1', '2.0.1'), isTrue);
  });

  test('ShareGo.ini can turn the update check off', () {
    expect(updateCheckAllowed(''), isTrue);
    expect(updateCheckAllowed('[updates]\ncheck=true\n'), isTrue);
    expect(updateCheckAllowed('[updates]\r\ncheck=false\r\n'), isFalse);
    expect(updateCheckAllowed('[Updates]\n Check = FALSE \n'), isFalse);
    expect(updateCheckAllowed('[other]\ncheck=false\n'), isTrue);
  });

  test('Release.fromJson reads the tag, page, and asset hashes', () {
    final release = Release.fromJson({
      'tag_name': 'v2.0.2',
      'html_url': 'https://github.com/MehdiMamas/ShareGo/releases/tag/v2.0.2',
      'assets': [
        {
          'name': 'ShareGo-macos.dmg',
          'browser_download_url': 'https://github.com/MehdiMamas/ShareGo/releases/download/v2.0.2/ShareGo-macos.dmg',
          'digest': 'sha256:abc123',
        },
        {
          'name': 'ShareGo-linux.tar.gz',
          'browser_download_url': 'https://github.com/MehdiMamas/ShareGo/releases/download/v2.0.2/ShareGo-linux.tar.gz',
        },
      ],
    })!;
    expect(release.version, '2.0.2');
    expect(release.asset('ShareGo-macos.dmg')!.sha256, 'abc123');
    expect(release.asset('ShareGo-linux.tar.gz')!.sha256, isNull);
    expect(release.asset('ShareGo-windows-setup.exe'), isNull);
  });

  test('Release.fromJson rejects a response without a tag', () {
    expect(Release.fromJson({'message': 'Not Found'}), isNull);
  });
}

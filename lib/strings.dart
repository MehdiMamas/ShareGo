import 'core/session.dart';

/// every user-facing string in the app.
abstract final class S {
  static const appName = 'ShareGo';
  static const tagline =
      'Send a secret to one other device on this Wi-Fi. Nothing is stored, and nothing leaves the network.';
  static const showCode = 'Show a code';
  static const enterCode = 'Enter a code';
  static const codeLabel = 'Code';
  static const addressLabel = 'Address';
  static const addressHint = '192.168.1.10:4040, if it is not found automatically';
  static const connect = 'Connect';
  static const scanQr = 'Scan QR code';
  static const scanHint = 'Point the camera at the QR code on the other device.';
  static const waitingForPeer = 'Waiting for the other device.';
  static const noAddress =
      'This device has no local network address. Connect the other device by entering that address yourself, from a device that shows one.';
  static const approveTitle = 'Allow this connection?';
  static const approve = 'Approve';
  static const reject = 'Reject';
  static const unknownDevice = 'Another device';
  static const waitingApproval =
      'Waiting for approval. Both screens should show this number.';
  static const verificationLabel = 'Verification number';
  static const messageHint = 'Password, code, or note';
  static const send = 'Send';
  static const copy = 'Copy';
  static const copied = 'Copied';
  static const endSession = 'End session';
  static const endTitle = 'End this session?';
  static const endBody =
      'The connection closes and the messages are cleared from this device.';
  static const cancel = 'Cancel';
  static const end = 'End';
  static const emptyChat = 'Nothing sent yet.';
  static const delivered = 'Delivered';
  static const sending = 'Sending';
  static const lookingUp = 'Looking for that code on the network.';
  static const notFound =
      'That code was not found. Enter the address shown on the other device.';
  static const invalidCode = 'Enter the 6-character code.';
  static const back = 'Back';
  static const tryAgain = 'Try again';

  static String countdown(int seconds) => 'New code in ${seconds}s';

  static String approveBody(String name, String number) =>
      '$name wants to connect.\n\nBoth screens should show $number.';

  static String error(SessionError error) => switch (error) {
        SessionError.connectionFailed => 'Could not connect.',
        SessionError.codeExpired => 'That code is no longer valid. Try the new one.',
        SessionError.keyMismatch =>
          'The other device does not match the QR code. The connection was closed.',
        SessionError.rejected => 'The connection was rejected.',
        SessionError.timedOut => 'The session timed out.',
        SessionError.peerClosed => 'The other device ended the session.',
        SessionError.invalidMessage => 'The connection closed because a message was invalid.',
      };
}

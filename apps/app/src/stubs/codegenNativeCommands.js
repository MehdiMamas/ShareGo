/**
 * stub for react-native codegen native commands.
 * on web, native commands are no-ops.
 */
export default function codegenNativeCommands(_options) {
  return new Proxy(
    {},
    {
      get() {
        return () => {};
      },
    },
  );
}

// polyfill crypto.getRandomValues (may be needed by some dependencies)
import "react-native-get-random-values";
// polyfill TextEncoder/TextDecoder (hermes doesn't include them)
import "fast-text-encoding";

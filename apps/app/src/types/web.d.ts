/**
 * augment react native ViewStyle to accept string values for height/minHeight.
 * react-native-web supports CSS string values like "100vh" but the RN types
 * only allow numbers. this avoids @ts-expect-error in ScreenContainer.
 */
import "react-native";

declare module "react-native" {
  interface ViewStyle {
    height?: number | string;
    minHeight?: number | string;
  }
}

/**
 * stub for react-native codegen native component.
 * on web, native components are just rendered as View elements.
 * this allows react-native-screens to load without crashing.
 */
import { View } from "react-native-web";

export default function codegenNativeComponent(_name, _options) {
  return View;
}

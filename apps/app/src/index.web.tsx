/**
 * web entry point for the electron renderer process.
 * registers the React Native app for web rendering via react-native-web.
 */
import { AppRegistry } from "react-native";
import App from "./App";

AppRegistry.registerComponent("ShareGo", () => App);
AppRegistry.runApplication("ShareGo", {
  rootTag: document.getElementById("root"),
});

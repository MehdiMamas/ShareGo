// shims must load first — crypto polyfill + WebAssembly stub for hermes
import "./src/shims";

import { AppRegistry } from "react-native";
import App from "./src/App";
import { name as appName } from "./app.json";

AppRegistry.registerComponent(appName, () => App);

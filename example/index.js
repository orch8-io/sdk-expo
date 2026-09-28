import { registerRootComponent } from "expo";
import { Text } from "react-native";
import { NativeEngine } from "@orch8.io/expo";

// Referencing NativeEngine keeps the native module in the bundle; the CI job
// only needs the app to build, not to run.
const App = () => <Text>{typeof NativeEngine}</Text>;

registerRootComponent(App);

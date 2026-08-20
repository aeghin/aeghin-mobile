import { AuthView } from "@clerk/expo/native";
import { View } from "react-native";

import { Logo } from "@/components/logo";

const LOGO_HEIGHT = 56;

export default function SignInScreen() {
  return (
    <View style={{ flex: 1 }}>
      <AuthView
        mode="signInOrUp"
        logo={<Logo size={LOGO_HEIGHT} />}
        logoMaxHeight={LOGO_HEIGHT}
        // There is nothing behind this screen to dismiss back to — it is the
        // whole signed-out state.
        isDismissible={false}
      />
    </View>
  );
}

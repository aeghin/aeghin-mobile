import { AuthView } from "@clerk/expo/native";

import { Logo } from "@/components/logo";
import { Box } from "@/components/ui/box";

const LOGO_HEIGHT = 56;

export default function SignInScreen() {
  return (
    <Box className="flex-1 bg-background">
      <AuthView
        mode="signInOrUp"
        logo={<Logo size={LOGO_HEIGHT} />}
        logoMaxHeight={LOGO_HEIGHT}
        isDismissible={false}
      />
    </Box>
  );
}

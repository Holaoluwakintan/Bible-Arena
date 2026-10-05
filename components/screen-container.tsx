import { View, type ViewProps, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { C, PAGE_X } from "@/constants/design";

interface ScreenContainerProps extends ViewProps {
  className?: string;
  containerClassName?: string;
  /** Edge-to-edge content (e.g. the quiz) can opt out of the page margin. */
  flush?: boolean;
  children: React.ReactNode;
}

export function ScreenContainer({ children, className: _className, containerClassName: _containerClassName, flush, style, ...props }: ScreenContainerProps) {
  return (
    <SafeAreaView edges={["top", "left", "right"]} style={[styles.safeArea]}>
      <View style={[styles.container, style]} {...props}>
        <View style={[styles.webFrame, !flush && styles.padded]}>{children}</View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: C.bg },
  container: { flex: 1, backgroundColor: C.bg },
  webFrame: { flex: 1, width: "100%", maxWidth: 640, alignSelf: "center" },
  padded: { paddingHorizontal: PAGE_X },
});

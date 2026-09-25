import { View, type ViewProps, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useColors } from "@/hooks/use-colors";

interface ScreenContainerProps extends ViewProps {
  className?: string;
  containerClassName?: string;
  children: React.ReactNode;
}

export function ScreenContainer({
  children,
  className,
  containerClassName,
  style,
  ...props
}: ScreenContainerProps) {
  const colors = useColors();

  return (
    <SafeAreaView
      edges={["top", "left", "right"]}
      style={[styles.safeArea, { backgroundColor: colors.background }]}
    >
      <View style={[styles.container, { backgroundColor: colors.background }, style]} {...props}>
        {children}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
});

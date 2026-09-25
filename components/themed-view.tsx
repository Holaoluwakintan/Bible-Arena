import { View, type ViewProps } from "react-native";
import { useColors } from "@/hooks/use-colors";

export type ThemedViewProps = ViewProps & {
  lightColor?: string;
  darkColor?: string;
};

export function ThemedView({ style, lightColor, darkColor, ...otherProps }: ThemedViewProps) {
  const colors = useColors();
  const backgroundColor = colors.background;

  return <View style={[{ backgroundColor }, style]} {...otherProps} />;
}

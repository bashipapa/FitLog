import { ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text as RNText,
  TextInput as RNTextInput,
  TextInputProps,
  View as RNView,
  ViewProps,
} from 'react-native';

import Colors from '@/constants/Colors';
import { useColorScheme } from './useColorScheme';

export function useTheme() {
  return Colors[useColorScheme()];
}

export function Screen({ style, ...rest }: ViewProps) {
  const t = useTheme();
  return <RNView style={[{ flex: 1, backgroundColor: t.background }, style]} {...rest} />;
}

export function Card({ style, ...rest }: ViewProps) {
  const t = useTheme();
  return (
    <RNView
      style={[{ backgroundColor: t.card, borderColor: t.border, borderWidth: StyleSheet.hairlineWidth }, s.card, style]}
      {...rest}
    />
  );
}

export function Title({ children }: { children: ReactNode }) {
  const t = useTheme();
  return <RNText style={[s.title, { color: t.text }]}>{children}</RNText>;
}

export function Label({ children }: { children: ReactNode }) {
  const t = useTheme();
  return <RNText style={[s.label, { color: t.muted }]}>{children}</RNText>;
}

export function Body({
  children,
  muted,
  bold,
  style,
  onPress,
}: {
  children: ReactNode;
  muted?: boolean;
  bold?: boolean;
  style?: object;
  onPress?: () => void;
}) {
  const t = useTheme();
  return (
    <RNText
      onPress={onPress}
      style={[s.body, { color: muted ? t.muted : t.text, fontWeight: bold ? '600' : '400' }, style]}>
      {children}
    </RNText>
  );
}

export function Big({ children, color }: { children: ReactNode; color?: string }) {
  const t = useTheme();
  return <RNText style={[s.big, { color: color ?? t.text }]}>{children}</RNText>;
}

export function Button({
  title,
  onPress,
  kind = 'primary',
  disabled,
  loading,
}: {
  title: string;
  onPress: () => void;
  kind?: 'primary' | 'secondary' | 'danger';
  disabled?: boolean;
  loading?: boolean;
}) {
  const t = useTheme();
  const bg = kind === 'primary' ? t.tint : kind === 'danger' ? t.danger : t.card;
  const fg = kind === 'secondary' ? t.text : '#fff';
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        s.button,
        { backgroundColor: bg, borderColor: t.border, opacity: disabled || loading ? 0.5 : pressed ? 0.8 : 1 },
      ]}>
      {loading ? <ActivityIndicator color={fg} /> : <RNText style={[s.buttonText, { color: fg }]}>{title}</RNText>}
    </Pressable>
  );
}

export function Input(props: TextInputProps) {
  const t = useTheme();
  return (
    <RNTextInput
      placeholderTextColor={t.muted}
      {...props}
      style={[s.input, { color: t.text, borderColor: t.border, backgroundColor: t.background }, props.style]}
    />
  );
}

export function Row({ style, ...rest }: ViewProps) {
  return <RNView style={[s.row, style]} {...rest} />;
}

export function Spacer({ h = 12 }: { h?: number }) {
  return <RNView style={{ height: h }} />;
}

const s = StyleSheet.create({
  card: { borderRadius: 14, padding: 14, marginBottom: 12 },
  title: { fontSize: 20, fontWeight: '700', marginBottom: 8 },
  label: { fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
  body: { fontSize: 15, lineHeight: 22 },
  big: { fontSize: 32, fontWeight: '700', fontVariant: ['tabular-nums'] },
  button: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
  },
  buttonText: { fontSize: 15, fontWeight: '600' },
  input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 16 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
});

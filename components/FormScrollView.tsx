import { ComponentProps } from 'react';
import { cssInterop } from 'nativewind';
import { KeyboardAwareScrollView, KeyboardAvoidingView } from 'react-native-keyboard-controller';

// Register third-party views with NativeWind so className props apply.
cssInterop(KeyboardAwareScrollView, { className: 'style', contentContainerClassName: 'contentContainerStyle' });
cssInterop(KeyboardAvoidingView, { className: 'style' });

type ScrollProps = ComponentProps<typeof KeyboardAwareScrollView> & {
  className?: string;
  contentContainerClassName?: string;
};

/** ScrollView for forms: scrolls the focused input above the keyboard. */
export function FormScrollView({ bottomOffset = 80, keyboardShouldPersistTaps = 'handled', ...props }: ScrollProps) {
  return <KeyboardAwareScrollView bottomOffset={bottomOffset} keyboardShouldPersistTaps={keyboardShouldPersistTaps} {...props} />;
}

type AvoidingProps = ComponentProps<typeof KeyboardAvoidingView> & { className?: string };

/** Keyboard-controller KeyboardAvoidingView with className support (for modals / non-scrolling forms). */
export function FormKeyboardAvoidingView(props: AvoidingProps) {
  return <KeyboardAvoidingView {...props} />;
}

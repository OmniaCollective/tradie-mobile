/**
 * Lets NativeWind classNames style components from other libraries, which it only does for
 * components registered here. Imported once, at the top of the root layout.
 */
import { cssInterop } from 'nativewind';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';

cssInterop(KeyboardAwareScrollView, {
  className: 'style',
  contentContainerClassName: 'contentContainerStyle',
});

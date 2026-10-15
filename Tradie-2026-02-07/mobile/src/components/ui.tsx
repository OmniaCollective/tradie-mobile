/**
 * Shared building blocks for brand system v4 (brand/BRAND-BRIEF.md).
 * Screens compose these so spacing, corners and colours stay identical everywhere.
 */
import React, { useState } from 'react';
import {
  View,
  Text,
  Pressable,
  ActivityIndicator,
  TextInput,
  Switch,
  Modal,
  Platform,
  type ScrollViewProps,
} from 'react-native';
import { useSafeAreaInsets, SafeAreaView } from 'react-native-safe-area-context';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { KEYBOARD_CLEARANCE } from '@/components/KeyboardDoneBar';
import { ChevronRight, ExternalLink, Check, X, type LucideIcon } from 'lucide-react-native';
import { cn } from '@/lib/cn';
import { useTheme, themeVars } from '@/lib/theme';

/** A grouped list or card: surface colour, 16px corners, no border. */
export function Group({ children, className }: { children: React.ReactNode; className?: string }) {
  return <View className={cn('bg-surface rounded-2xl overflow-hidden', className)}>{children}</View>;
}

/** Hairline between rows inside a Group, inset to line up with row text. */
export function RowDivider() {
  return <View className="h-px bg-divider ml-4" />;
}

/** Sentence-case section title with an optional text action on the right. */
export function SectionHeader({ title, actionLabel, onAction }: { title: string; actionLabel?: string; onAction?: () => void }) {
  return (
    <View className="flex-row items-baseline justify-between mx-1 mb-2.5">
      <Text className="text-fg text-[17px] font-semibold">{title}</Text>
      {actionLabel && onAction && (
        <Pressable onPress={onAction} hitSlop={12} accessibilityRole="button">
          <Text className="text-link text-[15px]">{actionLabel}</Text>
        </Pressable>
      )}
    </View>
  );
}

interface ButtonProps {
  label: string;
  onPress: () => void;
  icon?: LucideIcon;
  /** 40px tall header-sized button instead of the full 52px one. */
  compact?: boolean;
  loading?: boolean;
  disabled?: boolean;
  className?: string;
}

/** The one cyan action on a screen. Navy text on the logo cyan in both modes. */
export function PrimaryButton({ label, onPress, icon: Icon, compact, loading, disabled, className }: ButtonProps) {
  const t = useTheme();
  // Not ready yet: a plain grey button, not a faded cyan one (which looked broken).
  const off = disabled && !loading;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled, busy: !!loading }}
      className={cn(
        'rounded-xl flex-row items-center justify-center active:opacity-80',
        off ? 'bg-surface' : 'bg-accent',
        // Minimum heights, so the label never spills out at the largest text sizes
        compact ? 'min-h-10 px-3.5 py-1.5' : 'min-h-[52px] px-5 py-2.5',
        loading && 'opacity-70',
        className,
      )}
    >
      {loading ? (
        <ActivityIndicator color={t.onAccent} />
      ) : (
        <>
          {Icon && <Icon size={20} color={off ? t.secondary : t.onAccent} strokeWidth={2} />}
          <Text
            className={cn(
              off ? 'text-secondary' : 'text-on-accent',
              'font-semibold',
              compact ? 'text-[15px]' : 'text-[17px]',
              Icon && 'ml-1.5',
            )}
          >
            {label}
          </Text>
        </>
      )}
    </Pressable>
  );
}

/** iOS-style segmented control: quiet track, selected option raised. No accent fill. */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  className,
}: {
  options: { key: T; label: string }[];
  value: T;
  onChange: (key: T) => void;
  className?: string;
}) {
  return (
    <View className={cn('flex-row bg-surface rounded-xl p-1', className)} accessibilityRole="tablist">
      {options.map((o) => {
        const selected = o.key === value;
        return (
          <Pressable
            key={o.key}
            onPress={() => onChange(o.key)}
            className={cn('flex-1 h-9 rounded-lg items-center justify-center', selected && 'bg-divider')}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
          >
            <Text className={cn('text-sm font-semibold', selected ? 'text-fg' : 'text-secondary')}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** One option in a pick-one list inside a Group; the chosen row shows a tick. */
export function ChoiceRow({
  label,
  hint,
  selected,
  onPress,
}: {
  label: string;
  hint?: string;
  selected: boolean;
  onPress: () => void;
}) {
  const t = useTheme();
  return (
    <Pressable
      onPress={onPress}
      className="flex-row items-center px-4 min-h-[52px] py-2 active:opacity-70"
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
    >
      <View className="flex-1">
        <Text className="text-fg text-base">{label}</Text>
        {!!hint && <Text className="text-secondary text-sm mt-0.5">{hint}</Text>}
      </View>
      {selected && <Check size={20} color={t.link} strokeWidth={2} />}
    </Pressable>
  );
}

/** Thin progress bar. Accent fill by default; alert when something needs action. */
export function ProgressBar({ value, alert }: { value: number; alert?: boolean }) {
  const pct = Math.max(0, Math.min(100, value * 100));
  return (
    <View className="h-1.5 bg-divider rounded-full overflow-hidden">
      <View className={cn('h-full rounded-full', alert ? 'bg-alert' : 'bg-accent')} style={{ width: `${pct}%` }} />
    </View>
  );
}

/** Settings row with an editable value on the right, e.g. "Hourly rate  £ 60". */
export function FieldRow({
  label,
  hint,
  value,
  onChangeText,
  placeholder,
  prefix,
  suffix,
  keyboardType,
  autoCapitalize,
  width = 'w-40',
}: {
  label: string;
  hint?: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  prefix?: string;
  suffix?: string;
  keyboardType?: React.ComponentProps<typeof TextInput>['keyboardType'];
  autoCapitalize?: React.ComponentProps<typeof TextInput>['autoCapitalize'];
  /** Tailwind width class for the input. */
  width?: string;
}) {
  const t = useTheme();
  return (
    <View className="flex-row items-center px-4 min-h-[52px] py-2">
      <View className="flex-1 mr-3">
        <Text className="text-fg text-base">{label}</Text>
        {!!hint && <Text className="text-secondary text-[13px]">{hint}</Text>}
      </View>
      <View className="flex-row items-center">
        {!!prefix && <Text className="text-secondary text-base mr-1">{prefix}</Text>}
        <TextInput
          // With a £ or unit beside it, the box hugs the number so the symbol sits right next to it.
          className={cn('text-fg text-base text-right py-2', !(prefix || suffix) && width)}
          style={prefix || suffix ? { width: Math.max(24, (value || placeholder || '').length * 10 + 6) } : undefined}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={t.secondary}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          accessibilityLabel={label}
        />
        {!!suffix && <Text className="text-secondary text-base ml-1">{suffix}</Text>}
      </View>
    </View>
  );
}

/** Settings row with an on/off switch. */
export function ToggleRow({
  label,
  hint,
  value,
  onValueChange,
  disabled,
}: {
  label: string;
  hint?: string;
  value: boolean;
  onValueChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  const t = useTheme();
  // The whole row flips the switch, as in iPhone Settings; VoiceOver reads it as one switch.
  return (
    <Pressable
      onPress={() => !disabled && onValueChange(!value)}
      disabled={disabled}
      className="flex-row items-center px-4 min-h-[52px] py-2 active:opacity-80"
      accessibilityRole="switch"
      accessibilityState={{ checked: value, disabled: !!disabled }}
      accessibilityLabel={hint ? `${label}. ${hint}` : label}
    >
      <View className="flex-1 mr-3">
        <Text className="text-fg text-base">{label}</Text>
        {!!hint && <Text className="text-secondary text-[13px]">{hint}</Text>}
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        disabled={disabled}
        trackColor={{ false: t.divider, true: t.accent }}
        accessible={false}
        importantForAccessibility="no"
      />
    </Pressable>
  );
}

/** Tappable settings row: label, optional value, chevron (or external-link icon). */
export function LinkRow({
  label,
  value,
  onPress,
  icon: Icon,
  external,
  destructive,
}: {
  label: string;
  value?: string;
  onPress: () => void;
  icon?: LucideIcon;
  external?: boolean;
  destructive?: boolean;
}) {
  const t = useTheme();
  const Trailing = external ? ExternalLink : ChevronRight;
  return (
    <Pressable onPress={onPress} className="flex-row items-center px-4 min-h-[52px] active:opacity-70" accessibilityRole="button">
      {Icon && <Icon size={20} color={destructive ? t.alert : t.secondary} strokeWidth={2} style={{ marginRight: 12 }} />}
      <Text className={cn('flex-1 text-base', destructive ? 'text-alert' : 'text-fg')}>{label}</Text>
      {!!value && <Text className="text-secondary text-base mr-2">{value}</Text>}
      {!destructive && <Trailing size={16} color={t.secondary} strokeWidth={2} />}
    </Pressable>
  );
}

/**
 * FieldRow for numbers. Keeps the text you're typing ("1.", "0.") while saving
 * each valid number, so decimals can actually be entered.
 */
export function NumberFieldRow({
  value,
  onChangeNumber,
  fallback = 0,
  decimal = true,
  ...rest
}: Omit<React.ComponentProps<typeof FieldRow>, 'value' | 'onChangeText' | 'keyboardType'> & {
  value: number;
  onChangeNumber: (n: number) => void;
  /** Saved when the field is cleared. */
  fallback?: number;
  decimal?: boolean;
}) {
  const [draft, setDraft] = React.useState(String(value));
  // Follow outside changes (e.g. another screen) without clobbering what's being typed.
  if (parseFloat(draft) !== value && !(draft === '' && value === fallback) && !draft.endsWith('.')) {
    setDraft(String(value));
  }
  return (
    <FieldRow
      {...rest}
      value={draft}
      keyboardType={decimal ? 'decimal-pad' : 'number-pad'}
      onChangeText={(text) => {
        const clean = text.replace(',', '.');
        if (clean !== '' && !/^\d*\.?\d*$/.test(clean)) return;
        setDraft(clean);
        const n = parseFloat(clean);
        onChangeNumber(Number.isFinite(n) ? n : fallback);
      }}
    />
  );
}

/**
 * Bottom sheet. Modals render outside the app's root view, so the sheet sets
 * the theme variables itself; tapping the dimmed backdrop closes it.
 */
/**
 * A text field with its label above and any example as a hint below, so an empty field
 * never looks filled in.
 */
export function LabeledField({
  label,
  optional,
  hint,
  className,
  inputRef,
  ...input
}: {
  label: string;
  optional?: boolean;
  hint?: string;
  className?: string;
  /** To move focus here from another field (the keyboard's Next key). */
  inputRef?: React.RefObject<TextInput | null>;
} & React.ComponentProps<typeof TextInput>) {
  const t = useTheme();
  const ownRef = React.useRef<TextInput>(null);
  const ref = inputRef ?? ownRef;
  return (
    <View className={className}>
      {/* Tapping the label puts you in the box, as on a good web form */}
      <Pressable
        onPress={() => ref.current?.focus()}
        className="flex-row justify-between mx-0.5 mb-1.5"
        accessible={false}
        importantForAccessibility="no"
      >
        <Text className="text-secondary text-[13px]">{label}</Text>
        {optional && <Text className="text-secondary text-[13px]">optional</Text>}
      </Pressable>
      <TextInput
        ref={ref}
        className="bg-surface rounded-xl px-4 min-h-[48px] text-fg text-base"
        placeholderTextColor={t.secondary}
        accessibilityLabel={label}
        {...input}
      />
      {hint ? <Text className="text-secondary text-[13px] mx-0.5 mt-1.5">{hint}</Text> : null}
    </View>
  );
}

/** The X that closes anything opened on top: screens, sheets, pop-ups. 44pt to tap. */
export function CloseButton({ onPress, label = 'Close', plain }: { onPress: () => void; label?: string; plain?: boolean }) {
  const t = useTheme();
  return (
    <Pressable
      onPress={onPress}
      hitSlop={6}
      // plain: in the iPhone's own header bar, which already draws a round button around it
      className={cn('w-11 h-11 rounded-full items-center justify-center active:opacity-70', !plain && 'bg-surface')}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <X size={20} color={t.fg} strokeWidth={2} />
    </Pressable>
  );
}

/**
 * Header for a screen opened on top: title in the middle, X on the right. On iPhone the screen
 * is a card below the status bar, until a swipe up expands it to full screen (iOS 26+); the
 * SafeAreaView measures how far this header actually sits under the status bar, so it clears
 * it either way.
 */
export function ModalHeader({ title, onClose, left }: { title: string; onClose: () => void; left?: React.ReactNode }) {
  return (
    <SafeAreaView edges={['top']}>
      <View
        className="flex-row items-center justify-between px-4 pb-2"
        style={{ paddingTop: Platform.OS === 'ios' ? 12 : 8 }}
      >
        <View className="min-w-[44px]">{left}</View>
        <Text className="text-fg text-[17px] font-semibold flex-1 text-center" numberOfLines={1} accessibilityRole="header">
          {title}
        </Text>
        <CloseButton onPress={onClose} />
      </View>
    </SafeAreaView>
  );
}

/** Pinned to the bottom of a screen opened on top, for its one main button. */
export function ModalFooter({ children }: { children: React.ReactNode }) {
  const insets = useSafeAreaInsets();
  return (
    <View className="bg-bg px-4 pt-3 border-t border-divider" style={{ paddingBottom: insets.bottom + 12 }}>
      {children}
    </View>
  );
}

/**
 * A screen whose content scrolls above a fixed footer (the main button). The footer sits
 * below the content, never on top of it, so nothing is hidden behind it at any text size.
 * A hairline shows above the footer only while there's more to scroll to.
 */
export function ScrollScreen({
  children,
  header,
  footer,
  footerClassName,
  // Left out: the keyboard-aware scroll view keeps the field being typed in above the keyboard itself.
  automaticallyAdjustKeyboardInsets: _ignored,
  ...scrollProps
}: ScrollViewProps & { header?: React.ReactNode; footer?: React.ReactNode; footerClassName?: string }) {
  const insets = useSafeAreaInsets();
  const [box, setBox] = useState(0);
  const [content, setContent] = useState(0);
  const [offset, setOffset] = useState(0);
  const more = content - offset - box > 1;
  return (
    <View className="flex-1 bg-bg">
      {header}
      <KeyboardAwareScrollView
        style={{ flex: 1 }}
        bottomOffset={KEYBOARD_CLEARANCE}
        keyboardShouldPersistTaps="handled"
        scrollEventThrottle={32}
        {...scrollProps}
        onLayout={(e) => setBox(e.nativeEvent.layout.height)}
        onContentSizeChange={(_, h) => setContent(h)}
        onScroll={(e) => setOffset(e.nativeEvent.contentOffset.y)}
      >
        {children}
      </KeyboardAwareScrollView>
      {footer ? (
        <View
          className={cn('bg-bg px-4 pt-3 border-t', more ? 'border-divider' : 'border-transparent', footerClassName)}
          style={{ paddingBottom: insets.bottom + 12 }}
        >
          {footer}
        </View>
      ) : null}
    </View>
  );
}

/**
 * A sheet that slides up from the bottom. Every sheet has an X (top right); tapping
 * outside it closes it too. Read by VoiceOver as one block.
 */
export function Sheet({ visible, onClose, children }: { visible: boolean; onClose: () => void; children: React.ReactNode }) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <View className="flex-1 justify-end" style={themeVars[t.mode]}>
        <Pressable
          onPress={onClose}
          className="absolute inset-0 bg-black/50"
          accessibilityLabel="Close"
          accessibilityRole="button"
        />
        <View
          className="bg-surface rounded-t-3xl px-4 pt-2"
          style={{ paddingBottom: insets.bottom + 16 }}
          accessibilityViewIsModal
        >
          <View className="flex-row items-center justify-between mb-1">
            <View className="w-11" />
            <View className="w-9 h-[5px] rounded-full bg-divider" />
            <CloseButtonOnSurface onPress={onClose} />
          </View>
          {children}
        </View>
      </View>
    </Modal>
  );
}

/** The sheet's X sits on the surface colour, so it uses the page colour behind it. */
function CloseButtonOnSurface({ onPress }: { onPress: () => void }) {
  const t = useTheme();
  return (
    <Pressable
      onPress={onPress}
      hitSlop={6}
      className="w-11 h-11 rounded-full bg-bg items-center justify-center active:opacity-70"
      accessibilityRole="button"
      accessibilityLabel="Close"
    >
      <X size={20} color={t.fg} strokeWidth={2} />
    </Pressable>
  );
}

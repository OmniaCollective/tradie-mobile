/**
 * Shared building blocks for brand system v4 (brand/BRAND-BRIEF.md).
 * Screens compose these so spacing, corners and colours stay identical everywhere.
 */
import React from 'react';
import { View, Text, Pressable, ActivityIndicator, TextInput, Switch, Modal } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Lock, ChevronRight, ExternalLink, Check, type LucideIcon } from 'lucide-react-native';
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
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      accessibilityRole="button"
      className={cn(
        'bg-accent rounded-xl flex-row items-center justify-center active:opacity-80',
        compact ? 'h-10 px-3.5' : 'h-[52px] px-5',
        (disabled || loading) && 'opacity-50',
        className,
      )}
    >
      {loading ? (
        <ActivityIndicator color={t.onAccent} />
      ) : (
        <>
          {Icon && <Icon size={20} color={t.onAccent} strokeWidth={2} />}
          <Text className={cn('text-on-accent font-semibold', compact ? 'text-[15px]' : 'text-[17px]', Icon && 'ml-1.5')}>
            {label}
          </Text>
        </>
      )}
    </Pressable>
  );
}

/** Secondary action: surface fill with a divider border. */
export function SecondaryButton({ label, onPress, icon: Icon, compact, loading, disabled, className }: ButtonProps) {
  const t = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      accessibilityRole="button"
      className={cn(
        'bg-surface border border-divider rounded-xl flex-row items-center justify-center active:opacity-70',
        compact ? 'h-10 px-3.5' : 'h-[52px] px-5',
        (disabled || loading) && 'opacity-50',
        className,
      )}
    >
      {loading ? (
        <ActivityIndicator color={t.fg} />
      ) : (
        <>
          {Icon && <Icon size={20} color={t.fg} strokeWidth={2} />}
          <Text className={cn('text-fg font-semibold', compact ? 'text-[15px]' : 'text-[17px]', Icon && 'ml-1.5')}>{label}</Text>
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
        {hint && <Text className="text-secondary text-sm mt-0.5">{hint}</Text>}
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

/** What a Pro feature does, shown to free users in place of the feature. */
export function ProTeaser({
  title,
  body,
  onUnlock,
  className,
}: {
  title: string;
  body: string;
  onUnlock: () => void;
  className?: string;
}) {
  const t = useTheme();
  return (
    <Group className={cn('p-4', className)}>
      <View className="flex-row items-center mb-1">
        <Lock size={16} color={t.secondary} strokeWidth={2} />
        <Text className="text-fg text-[17px] font-semibold ml-2">{title}</Text>
      </View>
      <Text className="text-secondary text-[15px] leading-5">{body}</Text>
      <Pressable onPress={onUnlock} className="self-start min-h-[44px] justify-center" accessibilityRole="button">
        <Text className="text-link text-[15px] font-semibold">Unlock with Pro</Text>
      </Pressable>
    </Group>
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
        {hint && <Text className="text-secondary text-[13px]">{hint}</Text>}
      </View>
      <View className="flex-row items-center">
        {prefix && <Text className="text-secondary text-base mr-1">{prefix}</Text>}
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
        {suffix && <Text className="text-secondary text-base ml-1">{suffix}</Text>}
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
  return (
    <View className="flex-row items-center px-4 min-h-[52px] py-2">
      <View className="flex-1 mr-3">
        <Text className="text-fg text-base">{label}</Text>
        {hint && <Text className="text-secondary text-[13px]">{hint}</Text>}
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        disabled={disabled}
        trackColor={{ false: t.divider, true: t.accent }}
        accessibilityLabel={label}
      />
    </View>
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
      {value && <Text className="text-secondary text-base mr-2">{value}</Text>}
      {!destructive && <Trailing size={16} color={t.secondary} strokeWidth={2} />}
    </Pressable>
  );
}

/** A Group whose body opens and closes from its title row. */
export function Disclosure({
  title,
  summary,
  open,
  onToggle,
  children,
  className,
}: {
  title: string;
  summary?: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
  className?: string;
}) {
  const t = useTheme();
  return (
    <Group className={className}>
      <Pressable
        onPress={onToggle}
        className="flex-row items-center px-4 min-h-[52px] active:opacity-70"
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
      >
        <Text className="flex-1 text-fg text-base font-semibold">{title}</Text>
        {!open && summary && (
          <Text className="text-secondary text-sm mr-2" numberOfLines={1}>
            {summary}
          </Text>
        )}
        <ChevronRight
          size={16}
          color={t.secondary}
          strokeWidth={2}
          style={{ transform: [{ rotate: open ? '90deg' : '0deg' }] }}
        />
      </Pressable>
      {open && (
        <>
          <RowDivider />
          {children}
        </>
      )}
    </Group>
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
export function Sheet({ visible, onClose, children }: { visible: boolean; onClose: () => void; children: React.ReactNode }) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <Pressable
        onPress={onClose}
        className="flex-1 bg-black/50 justify-end"
        style={themeVars[t.mode]}
        accessibilityLabel="Close"
      >
        <Pressable
          onPress={() => {}}
          className="bg-surface rounded-t-3xl px-4 pt-5"
          style={{ paddingBottom: insets.bottom + 16 }}
        >
          {children}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

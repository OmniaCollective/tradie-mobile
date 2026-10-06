/**
 * Bottom-sheet dialog for messages and confirmations (brand system v4).
 * Normal confirms use the cyan button; destructive ones ("error" with an
 * onConfirm) use alert-red text, never a red fill.
 */
import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { CircleCheck, CircleAlert } from 'lucide-react-native';
import { useTheme } from '@/lib/theme';
import { PrimaryButton, Sheet } from '@/components/ui';

interface ConfirmModalProps {
  visible: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm?: () => void;
  onCancel?: () => void;
  onDismiss: () => void;
  variant?: 'default' | 'success' | 'error' | 'warning';
}

export function ConfirmModal({
  visible,
  title,
  message,
  confirmText,
  cancelText,
  onConfirm,
  onCancel,
  onDismiss,
  variant = 'default',
}: ConfirmModalProps) {
  const t = useTheme();
  const destructive = variant === 'error' && !!onConfirm;
  const Icon = variant === 'success' ? CircleCheck : variant === 'error' || variant === 'warning' ? CircleAlert : null;
  const iconColor = variant === 'success' ? t.link : t.alert;

  const confirm = () => {
    onConfirm?.();
    onDismiss();
  };
  const cancel = () => {
    onCancel?.();
    onDismiss();
  };

  return (
    <Sheet visible={visible} onClose={onDismiss}>
      <View className="pt-1 px-1">
        {Icon && (
          <View className="items-center mb-3">
            <Icon size={24} color={iconColor} strokeWidth={2} />
          </View>
        )}
        <Text className="text-fg text-[20px] font-semibold text-center mb-2" accessibilityRole="header">
          {title}
        </Text>
        <Text className="text-secondary text-[15px] leading-6 text-center mb-6">{message}</Text>

        {destructive ? (
          <Pressable
            onPress={confirm}
            className="h-[52px] rounded-xl bg-bg items-center justify-center active:opacity-70"
            accessibilityRole="button"
          >
            <Text className="text-alert text-[17px] font-semibold">{confirmText || 'Delete'}</Text>
          </Pressable>
        ) : (
          <PrimaryButton label={confirmText || 'OK'} onPress={onConfirm ? confirm : onDismiss} />
        )}

        {(onCancel || destructive) && (
          <Pressable onPress={cancel} className="min-h-[48px] items-center justify-center mt-1" accessibilityRole="button">
            <Text className="text-secondary text-base font-semibold">{cancelText || 'Cancel'}</Text>
          </Pressable>
        )}
      </View>
    </Sheet>
  );
}

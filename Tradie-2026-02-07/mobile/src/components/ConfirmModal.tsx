import React from 'react';
import { View, Text, Pressable, Modal } from 'react-native';
import Animated, { FadeIn, FadeOut, SlideInDown, SlideOutDown } from 'react-native-reanimated';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

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

const variantColors = {
  default: '#14B8A6',
  success: '#22C55E',
  error: '#EF4444',
  warning: '#F59E0B',
};

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
  const accentColor = variantColors[variant];
  const hasActions = onConfirm || onCancel;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onDismiss}
      statusBarTranslucent
    >
      <View className="flex-1 justify-end">
        {/* Backdrop */}
        <AnimatedPressable
          entering={FadeIn.duration(200)}
          exiting={FadeOut.duration(200)}
          onPress={onDismiss}
          className="absolute inset-0 bg-black/60"
        />

        {/* Content */}
        <Animated.View
          entering={SlideInDown.springify().damping(20).stiffness(200)}
          exiting={SlideOutDown.duration(200)}
          className="bg-[#1E293B] rounded-t-3xl px-6 pt-6 pb-10 border-t border-[#334155]"
        >
          {/* Handle */}
          <View className="w-10 h-1 rounded-full bg-[#334155] self-center mb-5" />

          <Text className="text-white font-bold text-xl mb-2">{title}</Text>
          <Text className="text-slate-400 text-base leading-6 mb-6">{message}</Text>

          {hasActions ? (
            <View className="gap-3">
              {onConfirm && (
                <Pressable
                  onPress={() => {
                    onConfirm();
                    onDismiss();
                  }}
                  className="rounded-xl p-4 items-center active:opacity-80"
                  style={{ backgroundColor: accentColor }}
                >
                  <Text className="text-white font-bold text-base">
                    {confirmText || 'OK'}
                  </Text>
                </Pressable>
              )}
              {onCancel && (
                <Pressable
                  onPress={() => {
                    onCancel();
                    onDismiss();
                  }}
                  className="rounded-xl p-4 items-center bg-[#334155] active:opacity-80"
                >
                  <Text className="text-slate-300 font-medium text-base">
                    {cancelText || 'Cancel'}
                  </Text>
                </Pressable>
              )}
            </View>
          ) : (
            <Pressable
              onPress={onDismiss}
              className="rounded-xl p-4 items-center active:opacity-80"
              style={{ backgroundColor: accentColor }}
            >
              <Text className="text-white font-bold text-base">
                {confirmText || 'OK'}
              </Text>
            </Pressable>
          )}
        </Animated.View>
      </View>
    </Modal>
  );
}

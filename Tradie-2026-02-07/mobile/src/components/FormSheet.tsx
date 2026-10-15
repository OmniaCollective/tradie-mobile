/**
 * A form on a card, the way iOS does it (Calendar's New Event, Contacts' New Contact): a tall
 * card with Cancel on the left, the title in the middle and the main action on the right, so
 * the keyboard can never cover them. The fields scroll underneath and the one being typed in
 * is kept above the keyboard, with a Done bar (number pads have no return key). Drag the top
 * bar down to close.
 *
 * With unsaved changes (`dirty`), dragging down springs back and Cancel asks first, so nothing
 * typed is lost by accident.
 *
 * The card is drawn here rather than as the system page sheet: most forms open from screens
 * that are already cards (Edit price, a job), and a system sheet on top of those leaves the
 * screen behind stretched under the status bar once it closes.
 *
 * Use it wherever something is typed. Short choices (menus, Pro prompts) stay as a Sheet.
 */
import React, { useState } from 'react';
import { View, Text, Pressable, Modal } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { useTheme, themeVars } from '@/lib/theme';
import { ConfirmModal } from '@/components/ConfirmModal';
import { KeyboardDoneBar, KEYBOARD_CLEARANCE } from '@/components/KeyboardDoneBar';

/** How far down (or how fast) a drag must go to close the card. */
const CLOSE_DISTANCE = 120;
const CLOSE_VELOCITY = 900;

export function FormSheet({
  visible,
  title,
  onCancel,
  actionLabel,
  onAction,
  actionDisabled,
  dirty,
  onDismissed,
  children,
}: {
  visible: boolean;
  title: string;
  /** Closes without saving. */
  onCancel: () => void;
  /** e.g. "Add", "Done", "Save". Leave out for a picker, where choosing a row is the action. */
  actionLabel?: string;
  onAction?: () => void;
  actionDisabled?: boolean;
  /** Something has been typed or changed that Cancel would throw away. */
  dirty?: boolean;
  /**
   * After the card has finished closing (only when it closes through `visible`). iOS can't
   * open anything else, like the share sheet, while a card is still closing.
   */
  onDismissed?: () => void;
  children: React.ReactNode;
}) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const cancel = () => (dirty ? setConfirmDiscard(true) : onCancel());

  // Drag the top bar down to close; with unsaved changes it springs back and asks.
  const y = useSharedValue(0);
  const drag = Gesture.Pan()
    .activeOffsetY(8)
    .onUpdate((e) => {
      y.value = Math.max(0, e.translationY);
    })
    .onEnd((e) => {
      const close = e.translationY > CLOSE_DISTANCE || e.velocityY > CLOSE_VELOCITY;
      if (close && !dirty) {
        scheduleOnRN(onCancel);
        return;
      }
      y.value = withSpring(0, { damping: 22, stiffness: 260 });
      if (close) scheduleOnRN(setConfirmDiscard, true);
    });
  const card = useAnimatedStyle(() => ({ transform: [{ translateY: y.value }] }));

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      statusBarTranslucent
      onRequestClose={cancel}
      onDismiss={onDismissed}
      onShow={() => y.set(0)}
    >
      <GestureHandlerRootView style={[{ flex: 1 }, themeVars[t.mode]]}>
        <Pressable onPress={cancel} style={{ height: insets.top + 10 }} accessibilityLabel="Close" accessibilityRole="button" />
        <Animated.View className="flex-1 bg-bg rounded-t-[22px] overflow-hidden" style={card} accessibilityViewIsModal>
          {/* The top bar: drag it down to close. Cancel and the action sit on top of the drag area so their taps go straight to them. */}
          <View>
            <GestureDetector gesture={drag}>
              <View className="pt-2 pb-2">
                <View className="w-9 h-[5px] rounded-full bg-divider self-center mb-1" />
                <View className="min-h-[44px] justify-center px-[92px]">
                  <Text className="text-fg text-[17px] font-semibold text-center" numberOfLines={1} accessibilityRole="header">
                    {title}
                  </Text>
                </View>
              </View>
            </GestureDetector>
            <Pressable
              onPress={cancel}
              hitSlop={8}
              className="absolute left-2 bottom-2 min-w-[76px] min-h-[44px] justify-center px-2 active:opacity-60"
              accessibilityRole="button"
            >
              <Text className="text-link text-[17px]">Cancel</Text>
            </Pressable>
            {actionLabel && (
              <Pressable
                onPress={onAction}
                disabled={actionDisabled}
                hitSlop={8}
                className="absolute right-2 bottom-2 min-w-[76px] min-h-[44px] items-end justify-center px-2 active:opacity-60"
                accessibilityRole="button"
                accessibilityState={{ disabled: !!actionDisabled }}
              >
                <Text
                  className={actionDisabled ? 'text-secondary text-[17px] font-semibold' : 'text-link text-[17px] font-semibold'}
                >
                  {actionLabel}
                </Text>
              </Pressable>
            )}
          </View>
          <KeyboardAwareScrollView
            bottomOffset={KEYBOARD_CLEARANCE}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 32 }}
          >
            {children}
          </KeyboardAwareScrollView>
        </Animated.View>
        <KeyboardDoneBar />
        <ConfirmModal
          visible={confirmDiscard}
          title="Discard changes?"
          message="What you’ve typed here hasn’t been saved."
          confirmText="Discard"
          cancelText="Keep editing"
          variant="error"
          onConfirm={onCancel}
          onCancel={() => {}}
          onDismiss={() => setConfirmDiscard(false)}
        />
      </GestureHandlerRootView>
    </Modal>
  );
}

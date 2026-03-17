import React, { useEffect } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Plus } from 'lucide-react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withRepeat,
  withSequence,
  withTiming,
  withDelay,
  Easing,
} from 'react-native-reanimated';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

interface FABProps {
  onPress: () => void;
  label?: string;
}

export function FAB({ onPress, label }: FABProps) {
  const scale = useSharedValue(1);
  const labelOpacity = useSharedValue(0);

  useEffect(() => {
    if (label) {
      // Fade in, then gently pulse
      labelOpacity.value = withDelay(
        600,
        withSequence(
          withTiming(1, { duration: 400, easing: Easing.out(Easing.quad) }),
          withDelay(
            200,
            withRepeat(
              withSequence(
                withTiming(0.5, { duration: 1800, easing: Easing.inOut(Easing.sin) }),
                withTiming(1, { duration: 1800, easing: Easing.inOut(Easing.sin) }),
              ),
              -1,
            ),
          ),
        ),
      );
    } else {
      labelOpacity.value = withTiming(0, { duration: 300 });
    }
  }, [label, labelOpacity]);

  const labelStyle = useAnimatedStyle(() => ({
    opacity: labelOpacity.value,
  }));

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <View
      style={{
        position: 'absolute',
        bottom: 24,
        right: 20,
        flexDirection: 'row',
        alignItems: 'center',
        zIndex: 9999,
        elevation: 9999,
      }}
      pointerEvents="box-none"
    >
      {label && (
        <Animated.View
          style={[
            {
              backgroundColor: '#1E293B',
              borderRadius: 12,
              paddingHorizontal: 14,
              paddingVertical: 8,
              marginRight: 12,
              borderWidth: 1,
              borderColor: '#14B8A6',
              shadowColor: '#14B8A6',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.25,
              shadowRadius: 6,
            },
            labelStyle,
          ]}
        >
          <Text style={{ color: '#E2E8F0', fontSize: 13, fontWeight: '600' }}>
            {label}
          </Text>
        </Animated.View>
      )}
      <AnimatedPressable
        onPress={onPress}
        onPressIn={() => {
          scale.value = withSpring(0.9, { damping: 15, stiffness: 400 });
        }}
        onPressOut={() => {
          scale.value = withSpring(1, { damping: 15, stiffness: 400 });
        }}
        style={[
          {
            width: 56,
            height: 56,
            borderRadius: 28,
            backgroundColor: '#14B8A6',
            alignItems: 'center',
            justifyContent: 'center',
            shadowColor: '#14B8A6',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.4,
            shadowRadius: 8,
            elevation: 8,
          },
          animatedStyle,
        ]}
      >
        <Plus size={28} color="#FFF" />
      </AnimatedPressable>
    </View>
  );
}

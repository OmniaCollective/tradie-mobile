import React, { useState, useRef, useCallback, useEffect } from 'react';
import { View, Text, Pressable } from 'react-native';
import { Mic, Square, X, Loader } from 'lucide-react-native';
import Animated, {
  FadeIn,
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  Easing,
  cancelAnimation,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { Audio } from 'expo-av';
import { processVoiceNote, ExtractedJobData } from '@/lib/voiceJobExtractor';
import { useTradeStore, usePricingPresets } from '@/lib/store';

const TURQUOISE = '#14B8A6';

type RecordingState = 'idle' | 'recording' | 'processing' | 'error';

interface VoiceRecorderProps {
  visible: boolean;
  onClose: () => void;
  onComplete: (data: ExtractedJobData) => void;
}

export function VoiceRecorder({ visible, onClose, onComplete }: VoiceRecorderProps) {
  const [state, setState] = useState<RecordingState>('idle');
  const [statusText, setStatusText] = useState('Tap the mic to start recording');
  const [errorMessage, setErrorMessage] = useState('');
  const [transcription, setTranscription] = useState('');
  const recordingRef = useRef<Audio.Recording | null>(null);
  const trade = useTradeStore((s) => s.settings.trade);
  const pricingPresets = usePricingPresets();

  // Pulsing animation for recording state
  const pulseScale = useSharedValue(1);
  const pulseOpacity = useSharedValue(0.3);

  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseScale.value }],
    opacity: pulseOpacity.value,
  }));

  useEffect(() => {
    if (state === 'recording') {
      pulseScale.value = withRepeat(
        withTiming(1.5, { duration: 1000, easing: Easing.inOut(Easing.ease) }),
        -1,
        true
      );
      pulseOpacity.value = withRepeat(
        withTiming(0, { duration: 1000, easing: Easing.inOut(Easing.ease) }),
        -1,
        true
      );
    } else {
      cancelAnimation(pulseScale);
      cancelAnimation(pulseOpacity);
      pulseScale.value = 1;
      pulseOpacity.value = 0.3;
    }
  }, [state, pulseScale, pulseOpacity]);

  const startRecording = useCallback(async () => {
    try {
      const { granted } = await Audio.requestPermissionsAsync();
      if (!granted) {
        setErrorMessage('Microphone permission is required');
        setState('error');
        return;
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );

      recordingRef.current = recording;
      setState('recording');
      setStatusText('Listening... tap to stop');
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch (error) {
      console.error('Failed to start recording:', error);
      setErrorMessage('Failed to start recording');
      setState('error');
    }
  }, []);

  const stopRecording = useCallback(async () => {
    if (!recordingRef.current) return;

    setState('processing');
    setStatusText('Transcribing...');
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    try {
      await recordingRef.current.stopAndUnloadAsync();
      await Audio.setAudioModeAsync({ allowsRecordingIOS: false });

      const uri = recordingRef.current.getURI();
      recordingRef.current = null;

      if (!uri) {
        throw new Error('No recording URI');
      }

      const { transcription: text, extracted } = await processVoiceNote(
        uri,
        trade,
        pricingPresets
      );

      setTranscription(text);
      setStatusText('Done!');
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      // Brief delay to show transcription before completing
      setTimeout(() => {
        onComplete(extracted);
      }, 800);
    } catch (error) {
      console.error('Voice processing error:', error);
      setErrorMessage(
        error instanceof Error ? error.message : 'Failed to process voice note'
      );
      setState('error');
    }
  }, [trade, pricingPresets, onComplete]);

  const handleMicPress = useCallback(() => {
    if (state === 'idle' || state === 'error') {
      setErrorMessage('');
      startRecording();
    } else if (state === 'recording') {
      stopRecording();
    }
  }, [state, startRecording, stopRecording]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (recordingRef.current) {
        recordingRef.current.stopAndUnloadAsync().catch(() => {});
      }
    };
  }, []);

  if (!visible) return null;

  return (
    <Animated.View
      entering={FadeIn.duration(200)}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.97)',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 200,
      }}
    >
      {/* Close button */}
      <Pressable
        onPress={onClose}
        style={{
          position: 'absolute',
          top: 60,
          right: 20,
          width: 40,
          height: 40,
          borderRadius: 20,
          backgroundColor: '#1E293B',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <X size={20} color="#F8FAFC" />
      </Pressable>

      <Animated.View entering={FadeInDown.duration(400)} className="items-center px-8">
        {/* Mic button with pulse */}
        <View className="items-center justify-center mb-6" style={{ width: 120, height: 120 }}>
          {state === 'recording' && (
            <Animated.View
              style={[
                {
                  position: 'absolute',
                  width: 120,
                  height: 120,
                  borderRadius: 60,
                  backgroundColor: '#EF4444',
                },
                pulseStyle,
              ]}
            />
          )}
          <Pressable
            onPress={handleMicPress}
            disabled={state === 'processing'}
            style={{
              width: 80,
              height: 80,
              borderRadius: 40,
              backgroundColor: state === 'recording' ? '#EF4444' : state === 'error' ? '#334155' : '#14B8A6',
              alignItems: 'center',
              justifyContent: 'center',
              opacity: state === 'processing' ? 0.5 : 1,
            }}
          >
            {state === 'recording' ? (
              <Square size={32} color="#FFF" fill="#FFF" />
            ) : state === 'processing' ? (
              <Loader size={32} color="#FFF" />
            ) : (
              <Mic size={32} color="#FFF" />
            )}
          </Pressable>
        </View>

        {/* Status text */}
        <Text className="text-white font-bold text-xl mb-2">
          {state === 'idle' && 'Voice Input'}
          {state === 'recording' && 'Recording...'}
          {state === 'processing' && 'Processing...'}
          {state === 'error' && 'Error'}
        </Text>

        <Text className="text-slate-400 text-center mb-4">
          {statusText}
        </Text>

        {/* Transcription preview */}
        {transcription && (
          <View className="bg-[#1E293B] rounded-xl border border-[#334155] p-4 w-full max-w-[320px] mb-4">
            <Text className="text-slate-400 text-xs uppercase tracking-wide mb-2">Transcription</Text>
            <Text className="text-white text-sm">{transcription}</Text>
          </View>
        )}

        {/* Error message */}
        {state === 'error' && errorMessage && (
          <View className="bg-[#EF4444]/20 rounded-xl p-4 w-full max-w-[320px] mb-4">
            <Text className="text-[#EF4444] text-sm text-center">{errorMessage}</Text>
          </View>
        )}

        {/* Helper text */}
        {state === 'idle' && (
          <Text className="text-slate-600 text-xs text-center max-w-[280px]">
            Example: "Got a call from Dave Smith on 07700 123456, needs a leaking tap fixed at 14 Oak Lane, SW1A 1AA, Thursday at 2pm"
          </Text>
        )}

        {/* Retry button for errors */}
        {state === 'error' && (
          <Pressable
            onPress={handleMicPress}
            className="bg-[#14B8A6] rounded-xl px-6 py-3 mt-2"
          >
            <Text className="text-white font-medium">Try Again</Text>
          </Pressable>
        )}
      </Animated.View>
    </Animated.View>
  );
}

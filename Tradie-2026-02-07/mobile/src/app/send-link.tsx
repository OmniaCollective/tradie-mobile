import React, { useState } from 'react';
import {
  View,
  Text,
  Pressable,
  TextInput,
  Share,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { X, Send, MessageCircle, Mail, Check, Crown, Smartphone } from 'lucide-react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import * as SMS from 'expo-sms';
import * as MailComposer from 'expo-mail-composer';
import { useTradeStore } from '@/lib/store';
import { useProAccess } from '@/lib/useProAccess';
import { UpgradePrompt } from '@/components/UpgradePrompt';
import { ConfirmModal } from '@/components/ConfirmModal';

const TURQUOISE = '#14B8A6';

export default function SendLinkScreen() {
  const router = useRouter();
  const settings = useTradeStore((s) => s.settings);
  const incrementBookingLinksSent = useTradeStore((s) => s.incrementBookingLinksSent);
  const [contactMethod, setContactMethod] = useState<'sms' | 'email' | null>(null);
  const [contactValue, setContactValue] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);
  const [showUpgradePrompt, setShowUpgradePrompt] = useState(false);
  const [modal, setModal] = useState<{ title: string; message: string; variant?: 'default' | 'success' | 'error' | 'warning' } | null>(null);

  const { canSendBookingLink, bookingLinksRemaining, bookingLinksSentThisMonth, isPro } = useProAccess();

  const businessName = settings.businessName || 'TRADIE';
  const contactPhone = settings.phone || '';
  const contactEmail = settings.email || '';

  // Build a plain-text booking message with the tradesperson's contact details
  const buildSmsMessage = () => {
    const lines = [
      `Hi ${customerName},`,
      '',
      `Thanks for getting in touch with ${businessName}! I'd love to help.`,
      '',
      `To book an appointment or get a quote:`,
      contactPhone ? `📞 Call or text: ${contactPhone}` : '',
      contactEmail ? `📧 Email: ${contactEmail}` : '',
      '',
      `Just let me know what you need and I'll get back to you with a quote.`,
      '',
      `Thanks,`,
      settings.ownerName || businessName,
    ].filter(Boolean);
    return lines.join('\n');
  };

  const buildEmailBody = () => {
    return `
<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 500px; margin: 0 auto;">
  <h2 style="color: #0F172A;">Hi ${customerName},</h2>
  <p style="color: #334155; font-size: 16px; line-height: 1.6;">
    Thanks for getting in touch! I'd love to help.
  </p>
  <p style="color: #334155; font-size: 16px; line-height: 1.6;">
    To book an appointment or get a quote, just reply to this email${contactPhone ? ` or give me a call on <strong>${contactPhone}</strong>` : ''}.
  </p>
  <p style="color: #334155; margin-top: 32px;">
    Thanks,<br/>
    <strong>${businessName}</strong>${contactPhone ? `<br/><span style="color: #64748B;">${contactPhone}</span>` : ''}${contactEmail ? `<br/><span style="color: #64748B;">${contactEmail}</span>` : ''}
  </p>
</div>`.trim();
  };

  const handleSendSMS = async () => {
    if (!customerName.trim() || !contactValue.trim()) return;

    if (!canSendBookingLink) {
      setShowUpgradePrompt(true);
      return;
    }

    setSending(true);
    const isAvailable = await SMS.isAvailableAsync();

    if (!isAvailable) {
      setModal({ title: 'SMS Not Available', message: 'SMS is not available on this device. Try email instead.', variant: 'warning' });
      setSending(false);
      return;
    }

    try {
      const { result } = await SMS.sendSMSAsync([contactValue], buildSmsMessage());

      if (result === 'sent' || result === 'unknown') {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        incrementBookingLinksSent();
        setSent(true);
        setTimeout(() => router.back(), 1500);
      }
    } catch (error) {
      console.error('SMS Error:', error);
      setModal({ title: 'Error', message: 'Failed to send SMS. Please try again.', variant: 'error' });
    }
    setSending(false);
  };

  const handleSendEmail = async () => {
    if (!customerName.trim() || !contactValue.trim()) return;

    if (!canSendBookingLink) {
      setShowUpgradePrompt(true);
      return;
    }

    setSending(true);
    const isAvailable = await MailComposer.isAvailableAsync();

    if (!isAvailable) {
      setModal({ title: 'Email Not Available', message: 'Email is not available on this device. Try SMS instead.', variant: 'warning' });
      setSending(false);
      return;
    }

    try {
      const result = await MailComposer.composeAsync({
        recipients: [contactValue],
        subject: `Book Your Appointment with ${businessName}`,
        body: buildEmailBody(),
        isHtml: true,
      });

      if (result.status === MailComposer.MailComposerStatus.SENT) {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        incrementBookingLinksSent();
        setSent(true);
        setTimeout(() => router.back(), 1500);
      }
    } catch (error) {
      console.error('Email Error:', error);
      setModal({ title: 'Error', message: 'Failed to send email. Please try again.', variant: 'error' });
    }
    setSending(false);
  };

  const handleSendLink = async () => {
    if (!customerName.trim()) return;

    if (!canSendBookingLink) {
      setShowUpgradePrompt(true);
      return;
    }

    // If contact method and value are provided, use direct send
    if (contactMethod === 'sms' && contactValue.trim()) {
      return handleSendSMS();
    }
    if (contactMethod === 'email' && contactValue.trim()) {
      return handleSendEmail();
    }

    // Fallback to share sheet
    try {
      await Share.share({
        message: buildSmsMessage(),
        title: `Book with ${businessName}`,
      });
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      incrementBookingLinksSent();
      setSent(true);
      setTimeout(() => {
        router.back();
      }, 1500);
    } catch (error) {
      console.error('Error sharing:', error);
    }
  };

  if (sent) {
    return (
      <View className="flex-1 bg-[#0F172A] items-center justify-center">
        <Animated.View
          entering={FadeInDown.duration(400)}
          className="items-center"
        >
          <View className="w-20 h-20 rounded-full bg-[#14B8A6]/20 items-center justify-center mb-4">
            <Check size={40} color={TURQUOISE} />
          </View>
          <Text className="text-white font-bold text-xl">Message Sent!</Text>
          <Text className="text-slate-400 mt-2">Customer will receive your booking invite</Text>
        </Animated.View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      className="flex-1 bg-[#0F172A]"
    >
      <View className="flex-1 px-4 pt-4">
        {/* Header */}
        <View className="flex-row items-center justify-between mb-6">
          <Pressable
            onPress={() => router.back()}
            className="w-10 h-10 rounded-full bg-[#1E293B] items-center justify-center"
          >
            <X size={20} color="#F8FAFC" />
          </Pressable>
          <Text className="text-white font-bold text-lg">Send Booking Invite</Text>
          <View className="w-10" />
        </View>

        {/* Content */}
        <Animated.View entering={FadeInDown.delay(100).duration(400)}>
          <Text className="text-slate-400 text-sm mb-6">
            Send your customer a message inviting them to book an appointment.
          </Text>

          {/* Customer Name Input */}
          <View className="mb-4">
            <Text className="text-slate-400 text-sm mb-2">Customer Name</Text>
            <TextInput
              className="bg-[#1E293B] rounded-xl px-4 py-4 text-white text-base border border-[#334155]"
              value={customerName}
              onChangeText={setCustomerName}
              placeholder="Enter customer's name"
              placeholderTextColor="#64748B"
              autoFocus
            />
          </View>

          {/* Message Preview */}
          {customerName.trim().length > 0 && (
            <Animated.View entering={FadeInDown.duration(300)} className="mb-6">
              <Text className="text-slate-400 text-xs mb-2">Message Preview</Text>
              <View className="bg-[#1E293B] rounded-xl p-4 border border-[#334155]">
                <Text className="text-slate-300 text-sm leading-5">
                  Hi {customerName},{'\n\n'}
                  Thanks for getting in touch! I'd love to help.{'\n\n'}
                  To book an appointment or get a quote, just reply to this message{contactPhone ? ` or give me a call on ${contactPhone}` : ''}.{'\n\n'}
                  Thanks,{'\n'}
                  {businessName}
                </Text>
              </View>
            </Animated.View>
          )}

          {/* Hand Phone to Customer */}
          {customerName.trim().length > 0 && (
            <Animated.View entering={FadeInDown.duration(300)} className="mb-6">
              <Pressable
                onPress={() => router.push('/book/booking')}
                className="bg-[#1E293B] border border-[#334155] rounded-xl p-4 flex-row items-center active:opacity-80"
              >
                <View className="w-10 h-10 rounded-full bg-[#14B8A6]/20 items-center justify-center mr-3">
                  <Smartphone size={20} color={TURQUOISE} />
                </View>
                <View className="flex-1">
                  <Text className="text-white font-semibold">Let Customer Book on This Phone</Text>
                  <Text className="text-slate-500 text-xs mt-0.5">Hand your phone to the customer to fill in their details</Text>
                </View>
              </Pressable>
            </Animated.View>
          )}

          {/* Send Options */}
          <Text className="text-slate-400 text-sm mb-3">Send via</Text>
          <View className="flex-row gap-3 mb-6">
            <Pressable
              onPress={() => setContactMethod('sms')}
              className={`flex-1 p-4 rounded-xl border items-center ${
                contactMethod === 'sms'
                  ? 'bg-[#14B8A6]/20 border-[#14B8A6]'
                  : 'bg-[#1E293B] border-[#334155]'
              }`}
            >
              <MessageCircle
                size={24}
                color={contactMethod === 'sms' ? TURQUOISE : '#64748B'}
              />
              <Text
                className={`mt-2 font-medium ${
                  contactMethod === 'sms' ? 'text-[#14B8A6]' : 'text-slate-400'
                }`}
              >
                SMS
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setContactMethod('email')}
              className={`flex-1 p-4 rounded-xl border items-center ${
                contactMethod === 'email'
                  ? 'bg-[#14B8A6]/20 border-[#14B8A6]'
                  : 'bg-[#1E293B] border-[#334155]'
              }`}
            >
              <Mail
                size={24}
                color={contactMethod === 'email' ? TURQUOISE : '#64748B'}
              />
              <Text
                className={`mt-2 font-medium ${
                  contactMethod === 'email' ? 'text-[#14B8A6]' : 'text-slate-400'
                }`}
              >
                Email
              </Text>
            </Pressable>
          </View>

          {/* Contact Input */}
          {contactMethod && (
            <Animated.View entering={FadeInDown.duration(300)} className="mb-6">
              <Text className="text-slate-400 text-sm mb-2">
                {contactMethod === 'sms' ? 'Phone Number' : 'Email Address'}
              </Text>
              <TextInput
                className="bg-[#1E293B] rounded-xl px-4 py-4 text-white text-base border border-[#334155]"
                value={contactValue}
                onChangeText={setContactValue}
                placeholder={contactMethod === 'sms' ? '07700 000000' : 'customer@email.com'}
                placeholderTextColor="#64748B"
                keyboardType={contactMethod === 'sms' ? 'phone-pad' : 'email-address'}
                autoCapitalize="none"
              />
            </Animated.View>
          )}
        </Animated.View>

        {/* Send Button */}
        <View className="mt-auto pb-8">
          {/* Usage indicator for free users */}
          {!isPro && (
            <View className="flex-row items-center justify-center mb-3">
              <Text className="text-slate-500 text-sm">
                {bookingLinksRemaining > 0
                  ? `${bookingLinksRemaining} free invite${bookingLinksRemaining !== 1 ? 's' : ''} remaining this month`
                  : 'No free invites remaining'}
              </Text>
              {bookingLinksRemaining <= 3 && bookingLinksRemaining > 0 && (
                <Pressable
                  onPress={() => router.push('/paywall')}
                  className="ml-2 flex-row items-center"
                >
                  <Crown size={14} color="#14B8A6" />
                  <Text className="text-[#14B8A6] text-sm ml-1">Upgrade</Text>
                </Pressable>
              )}
            </View>
          )}

          <Pressable
            onPress={handleSendLink}
            disabled={!customerName.trim() || sending}
            className={`rounded-xl p-4 flex-row items-center justify-center ${
              customerName.trim() && !sending
                ? 'bg-[#14B8A6] active:opacity-80'
                : 'bg-[#334155]'
            }`}
          >
            <Send size={20} color={customerName.trim() && !sending ? '#FFF' : '#64748B'} />
            <Text
              className={`font-bold text-base ml-2 ${
                customerName.trim() && !sending ? 'text-white' : 'text-slate-500'
              }`}
            >
              {sending ? 'Sending...' : contactMethod && contactValue.trim() ? `Send via ${contactMethod === 'sms' ? 'SMS' : 'Email'}` : 'Send Booking Invite'}
            </Text>
          </Pressable>
        </View>
      </View>

      {/* Upgrade Prompt Modal */}
      <UpgradePrompt
        visible={showUpgradePrompt}
        onClose={() => setShowUpgradePrompt(false)}
        feature="bookingLinks"
        currentUsage={bookingLinksSentThisMonth}
      />

      {modal && (
        <ConfirmModal
          visible={!!modal}
          title={modal.title}
          message={modal.message}
          variant={modal.variant}
          onDismiss={() => setModal(null)}
        />
      )}
    </KeyboardAvoidingView>
  );
}

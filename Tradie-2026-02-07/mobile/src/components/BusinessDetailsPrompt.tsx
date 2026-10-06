/**
 * Before a quote, invoice or reminder goes to a customer, checks the tradie's
 * profile has what that document needs. Anything missing is asked for right
 * there in a sheet, saved to Account, and then the send carries on. Documents
 * never go out with placeholder details.
 */
import React, { useState } from 'react';
import { View, Text, Pressable, ScrollView, TextInput } from 'react-native';
import { useTradeStore, useRegion, businessDisplayName, type BusinessSettings } from '@/lib/store';
import { useTheme } from '@/lib/theme';
import { cn } from '@/lib/cn';
import { Group, RowDivider, PrimaryButton, Sheet } from '@/components/ui';

export type CustomerDocument = 'quote' | 'invoice' | 'message';

type Field = 'name' | 'contact' | 'address' | 'paymentDetails';

/** What this document needs that the profile doesn't have yet. */
export function missingDetails(settings: BusinessSettings, document: CustomerDocument, country: 'GB' | 'US'): Field[] {
  const missing: Field[] = [];
  if (!businessDisplayName(settings)) missing.push('name');
  if (document === 'message') return missing;
  if (!settings.phone.trim() && !settings.email.trim()) missing.push('contact');
  if (document === 'invoice') {
    // HMRC requires the supplier's address on a VAT invoice.
    if (settings.vatRegistered && country === 'GB' && !settings.address.trim()) missing.push('address');
    if (!settings.paymentDetails.trim()) missing.push('paymentDetails');
  }
  return missing;
}

const PURPOSE: Record<CustomerDocument, string> = {
  quote: 'These go on your quote, so the customer knows who it’s from and how to reach you.',
  invoice: 'These go on your invoice, so the customer knows who to pay and how.',
  message: 'Your name goes at the end of the text, so the customer knows who it’s from.',
};

/**
 * `requireDetails(document, send)` runs `send` straight away if the profile is
 * complete, or opens the sheet first and runs it after the details are saved.
 * `send` gets the up-to-date settings. Render `prompt` once in the screen.
 */
export function useBusinessDetailsPrompt() {
  const { country } = useRegion();
  const [pending, setPending] = useState<{
    document: CustomerDocument;
    missing: Field[];
    send: (settings: BusinessSettings) => void | Promise<void>;
  } | null>(null);

  const requireDetails = (document: CustomerDocument, send: (settings: BusinessSettings) => void | Promise<void>) => {
    const settings = useTradeStore.getState().settings;
    const missing = missingDetails(settings, document, country);
    if (missing.length === 0) return send(settings);
    setPending({ document, missing, send });
  };

  const prompt = pending ? (
    <BusinessDetailsSheet
      document={pending.document}
      missing={pending.missing}
      onClose={() => setPending(null)}
      onSaved={() => {
        const { send } = pending;
        setPending(null);
        send(useTradeStore.getState().settings);
      }}
    />
  ) : null;

  return { requireDetails, prompt };
}

function BusinessDetailsSheet({
  document,
  missing,
  onClose,
  onSaved,
}: {
  document: CustomerDocument;
  missing: Field[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const settings = useTradeStore((s) => s.settings);
  const updateSettings = useTradeStore((s) => s.updateSettings);
  const { country } = useRegion();
  const isUS = country === 'US';
  const t = useTheme();

  const [businessName, setBusinessName] = useState(settings.businessName);
  const [ownerName, setOwnerName] = useState(settings.ownerName);
  const [phone, setPhone] = useState(settings.phone);
  const [email, setEmail] = useState(settings.email);
  const [address, setAddress] = useState(settings.address);
  const [paymentDetails, setPaymentDetails] = useState(settings.paymentDetails);

  const asks = (field: Field) => missing.includes(field);
  const complete =
    (!asks('name') || !!(businessName.trim() || ownerName.trim())) &&
    (!asks('contact') || !!(phone.trim() || email.trim())) &&
    (!asks('address') || !!address.trim()) &&
    (!asks('paymentDetails') || !!paymentDetails.trim());

  const save = () => {
    updateSettings({
      ...(asks('name') && { businessName: businessName.trim(), ownerName: ownerName.trim() }),
      ...(asks('contact') && { phone: phone.trim(), email: email.trim() }),
      ...(asks('address') && { address: address.trim() }),
      ...(asks('paymentDetails') && { paymentDetails: paymentDetails.trim() }),
    });
    onSaved();
  };

  const input = (props: {
    label: string;
    value: string;
    onChangeText: (v: string) => void;
    placeholder: string;
    multiline?: boolean;
    keyboardType?: React.ComponentProps<typeof TextInput>['keyboardType'];
    autoCapitalize?: React.ComponentProps<typeof TextInput>['autoCapitalize'];
  }) => (
    <View className="px-4 pt-3 pb-1">
      <Text className="text-secondary text-[13px]">{props.label}</Text>
      <TextInput
        className={cn('text-fg text-base py-2', props.multiline && 'min-h-[72px]')}
        style={props.multiline ? { textAlignVertical: 'top' } : undefined}
        value={props.value}
        onChangeText={props.onChangeText}
        placeholder={props.placeholder}
        placeholderTextColor={t.secondary}
        multiline={props.multiline}
        scrollEnabled={false}
        keyboardType={props.keyboardType}
        autoCapitalize={props.autoCapitalize}
        accessibilityLabel={props.label}
      />
    </View>
  );

  return (
    <Sheet visible onClose={onClose}>
      <ScrollView keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets style={{ maxHeight: 560 }}>
        <Text className="text-fg text-[20px] font-semibold mb-1">Add your business details</Text>
        <Text className="text-secondary text-[15px] leading-5 mb-5">
          {PURPOSE[document]} You only need to do this once.
        </Text>

        <Group className="mb-5 bg-bg">
          {asks('name') && (
            <>
              {input({ label: 'Business name', value: businessName, onChangeText: setBusinessName, placeholder: isUS ? 'As on your truck' : 'As on your van', autoCapitalize: 'words' })}
              <RowDivider />
              {input({ label: 'Your name', value: ownerName, onChangeText: setOwnerName, placeholder: 'First and last', autoCapitalize: 'words' })}
            </>
          )}
          {asks('contact') && (
            <>
              {asks('name') && <RowDivider />}
              {input({ label: 'Phone', value: phone, onChangeText: setPhone, placeholder: isUS ? '(555) 555-0100' : '07700 900000', keyboardType: 'phone-pad' })}
              <RowDivider />
              {input({ label: 'Email', value: email, onChangeText: setEmail, placeholder: 'you@example.com', keyboardType: 'email-address', autoCapitalize: 'none' })}
            </>
          )}
          {asks('address') && (
            <>
              {(asks('name') || asks('contact')) && <RowDivider />}
              {input({ label: 'Business address (needed on VAT invoices)', value: address, onChangeText: setAddress, placeholder: '12 High Street, London', multiline: true })}
            </>
          )}
          {asks('paymentDetails') && (
            <>
              {missing.length > 1 && <RowDivider />}
              {input({
                label: 'How customers pay you',
                value: paymentDetails,
                onChangeText: setPaymentDetails,
                placeholder: isUS
                  ? 'Zelle: you@example.com\nChecks payable to Your Business'
                  : 'Bank: Your Bank\nName: Your Business\nSort code: 00-00-00\nAccount: 12345678',
                multiline: true,
              })}
            </>
          )}
        </Group>

        <PrimaryButton label={document === 'message' ? 'Save and continue' : `Save and send ${document}`} onPress={save} disabled={!complete} />
        <Pressable onPress={onClose} className="min-h-[48px] items-center justify-center mt-1" accessibilityRole="button">
          <Text className="text-secondary text-base font-semibold">Not now</Text>
        </Pressable>
      </ScrollView>
    </Sheet>
  );
}

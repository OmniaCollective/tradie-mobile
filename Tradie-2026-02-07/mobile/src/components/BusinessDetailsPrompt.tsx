/**
 * Before a quote, invoice or reminder goes to a customer, checks the tradie's
 * profile has what that document needs. Anything missing is asked for right
 * there in a sheet, saved to Account, and then the send carries on. Documents
 * never go out with placeholder details.
 */
import React, { useState } from 'react';
import { View, Text, TextInput } from 'react-native';
import { useTradeStore, useRegion, businessDisplayName, type BusinessSettings } from '@/lib/store';
import { useTheme } from '@/lib/theme';
import { cn } from '@/lib/cn';
import { Group, RowDivider } from '@/components/ui';
import { FormSheet } from '@/components/FormSheet';

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
  const [open, setOpen] = useState(false);
  // Sending opens the share sheet, which iOS can only show once the card has finished closing.
  const [sendAfterClose, setSendAfterClose] = useState(false);

  const requireDetails = (document: CustomerDocument, send: (settings: BusinessSettings) => void | Promise<void>) => {
    const settings = useTradeStore.getState().settings;
    const missing = missingDetails(settings, document, country);
    if (missing.length === 0) return send(settings);
    setPending({ document, missing, send });
    setSendAfterClose(false);
    setOpen(true);
  };

  const prompt = pending ? (
    <BusinessDetailsSheet
      visible={open}
      document={pending.document}
      missing={pending.missing}
      onClose={() => setOpen(false)}
      onSaved={() => {
        setSendAfterClose(true);
        setOpen(false);
      }}
      onDismissed={() => {
        const { send } = pending;
        setPending(null);
        if (sendAfterClose) void send(useTradeStore.getState().settings);
      }}
    />
  ) : null;

  return { requireDetails, prompt };
}

function BusinessDetailsSheet({
  visible,
  document,
  missing,
  onClose,
  onSaved,
  onDismissed,
}: {
  visible: boolean;
  document: CustomerDocument;
  missing: Field[];
  onClose: () => void;
  onSaved: () => void;
  onDismissed: () => void;
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
    <FormSheet
      visible={visible}
      title="Your business details"
      onCancel={onClose}
      actionLabel={document === 'message' ? 'Continue' : 'Send'}
      onAction={save}
      actionDisabled={!complete}
      onDismissed={onDismissed}
    >
      <Text className="text-secondary text-[15px] leading-5 mb-5 mx-1">{PURPOSE[document]} You only need to do this once.</Text>

      <Group className="mb-3">
        {asks('name') && (
          <>
            {input({
              label: 'Business name',
              value: businessName,
              onChangeText: setBusinessName,
              placeholder: isUS ? 'As on your truck' : 'As on your van',
              autoCapitalize: 'words',
            })}
            <RowDivider />
            {input({
              label: 'Your name',
              value: ownerName,
              onChangeText: setOwnerName,
              placeholder: 'First and last',
              autoCapitalize: 'words',
            })}
          </>
        )}
        {asks('contact') && (
          <>
            {asks('name') && <RowDivider />}
            {input({
              label: 'Phone',
              value: phone,
              onChangeText: setPhone,
              placeholder: isUS ? '(555) 555-0100' : '07700 900000',
              keyboardType: 'phone-pad',
            })}
            <RowDivider />
            {input({
              label: 'Email',
              value: email,
              onChangeText: setEmail,
              placeholder: 'you@example.com',
              keyboardType: 'email-address',
              autoCapitalize: 'none',
            })}
          </>
        )}
        {asks('address') && (
          <>
            {(asks('name') || asks('contact')) && <RowDivider />}
            {input({
              label: 'Business address (needed on VAT invoices)',
              value: address,
              onChangeText: setAddress,
              placeholder: '12 High Street, London',
              multiline: true,
            })}
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

      <Text className="text-secondary text-[13px] mx-1">
        {document === 'message'
          ? 'Saved to Account, then your message opens.'
          : `Saved to Account, then your ${document} opens to send.`}
      </Text>
    </FormSheet>
  );
}

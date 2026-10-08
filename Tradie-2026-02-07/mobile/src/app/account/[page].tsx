/**
 * One Account page, opened on top of the Account list (X to close). Your business and Getting
 * paid have a Save button (grey until something changes); prices, tax and settings save as you
 * go, and say so. Agreed design: release/ux-journey-review.md.
 */
import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, Linking, Pressable } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import {
  useTradeStore,
  useSettings,
  usePricingPresets,
  useJobs,
  useRegion,
  reminderPrefs,
  type USFilingStatus,
  jobName,
} from '@/lib/store';
import { COUNTRY_OPTIONS } from '@/lib/region';
import { mileageRate } from '@/lib/data/usTax2026';
import { requestCalendarPermissions, hasCalendarPermissions, syncAllJobsToCalendar } from '@/lib/calendarSync';
import { setDailyReminder, cancelAllReminders, ensureNotificationPermission } from '@/lib/notifications';
import { useProAccess, useRefreshPro } from '@/lib/useProAccess';
import { restorePurchases } from '@/lib/revenuecatClient';
import { useAccount, signOut, deleteAccount } from '@/lib/auth';
import { AppleSignInButton } from '@/components/AppleSignInButton';
import { ConfirmModal } from '@/components/ConfirmModal';
import { RenewalsSection } from '@/components/Renewals';
import {
  Group,
  RowDivider,
  SectionHeader,
  FieldRow,
  NumberFieldRow,
  ToggleRow,
  LinkRow,
  Segmented,
  ChoiceRow,
  ModalHeader,
  ModalFooter,
  PrimaryButton,
  LabeledField,
} from '@/components/ui';
import { currencySymbol } from '@/lib/money';
import { useTheme } from '@/lib/theme';
import { Check } from 'lucide-react-native';
import { toast } from '@/components/Toast';

export type AccountPage =
  'business' | 'pay' | 'prices' | 'insurance' | 'diary' | 'reminders' | 'appearance' | 'plan' | 'signin' | 'help';

const SUPPORT_EMAIL = 'paul@builtbyomnia.com';

const FILING_STATUSES: { key: USFilingStatus; label: string }[] = [
  { key: 'single', label: 'Single' },
  { key: 'married_joint', label: 'Married filing jointly' },
  { key: 'head_of_household', label: 'Head of household' },
];

/** 72.5¢ */
const cents = (dollars: number) => `${+(dollars * 100).toFixed(1)}¢`;

export default function AccountPageScreen() {
  const { page } = useLocalSearchParams<{ page: AccountPage }>();
  const router = useRouter();
  const close = () => (router.canGoBack() ? router.back() : router.replace('/(tabs)/settings'));
  const region = useRegion();
  const isUS = region.country === 'US';

  const titles: Record<AccountPage, string> = {
    business: 'Your business',
    pay: 'Getting paid',
    prices: 'Prices and tax',
    insurance: 'Insurance and licences',
    diary: isUS ? 'Schedule' : 'Diary',
    reminders: 'Reminders',
    appearance: 'Appearance',
    plan: 'Plan',
    signin: 'Sign in',
    help: 'Help and legal',
  };

  const body = (() => {
    switch (page) {
      case 'business':
        return <BusinessPage onDone={close} />;
      case 'pay':
        return <PayPage onDone={close} />;
      case 'prices':
        return <PricesPage />;
      case 'insurance':
        return (
          <ScrollView
            className="flex-1"
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ padding: 16, paddingBottom: 48 }}
          >
            <RenewalsSection />
          </ScrollView>
        );
      case 'diary':
        return <DiaryPage />;
      case 'reminders':
        return <RemindersPage />;
      case 'appearance':
        return <AppearancePage />;
      case 'plan':
        return <PlanPage />;
      case 'signin':
        return <SignInPage onDone={close} />;
      case 'help':
        return <HelpPage />;
      default:
        return null;
    }
  })();

  return (
    <View className="flex-1 bg-bg">
      <ModalHeader title={titles[page as AccountPage] ?? 'Account'} onClose={close} />
      {body}
    </View>
  );
}

// ── Your business (Save) ───────────────────────────────────────────────────────

function BusinessPage({ onDone }: { onDone: () => void }) {
  const settings = useSettings();
  const region = useRegion();
  const isUS = region.country === 'US';
  const updateSettings = useTradeStore((s) => s.updateSettings);
  const setCountry = useTradeStore((s) => s.setCountry);
  const start = {
    country: region.country,
    ownerName: settings.ownerName,
    businessName: settings.businessName,
    phone: settings.phone,
    email: settings.email,
    address: settings.address,
    postcode: settings.postcode,
  };
  const [d, setD] = useState(start);
  const changed = (Object.keys(start) as (keyof typeof start)[]).some((k) => d[k] !== start[k]);
  const save = async () => {
    if (d.country !== start.country) setCountry(d.country);
    updateSettings({
      ownerName: d.ownerName.trim(),
      businessName: d.businessName.trim(),
      phone: d.phone.trim(),
      email: d.email.trim(),
      address: d.address.trim(),
      postcode: d.postcode.trim().toUpperCase(),
    });
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    toast('Business details saved');
    onDone();
  };
  const usNow = d.country === 'US';
  return (
    <>
      <ScrollView
        className="flex-1"
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
        contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
      >
        <View className="gap-4">
          <View>
            <Text className="text-secondary text-[13px] mx-0.5 mb-1.5">Country</Text>
            <Segmented options={COUNTRY_OPTIONS} value={d.country} onChange={(c) => setD({ ...d, country: c })} />
          </View>
          <LabeledField
            label="Your name"
            value={d.ownerName}
            onChangeText={(v) => setD({ ...d, ownerName: v })}
            autoCapitalize="words"
          />
          <LabeledField
            label="Business name"
            optional
            value={d.businessName}
            onChangeText={(v) => setD({ ...d, businessName: v })}
            autoCapitalize="words"
            hint={usNow ? 'As on your truck. Shown on quotes and invoices.' : 'As on your van. Shown on quotes and invoices.'}
          />
          <LabeledField label="Mobile" value={d.phone} onChangeText={(v) => setD({ ...d, phone: v })} keyboardType="phone-pad" />
          <LabeledField
            label="Email"
            optional
            value={d.email}
            onChangeText={(v) => setD({ ...d, email: v })}
            keyboardType="email-address"
            autoCapitalize="none"
          />
          <LabeledField
            label="Business address"
            optional
            value={d.address}
            onChangeText={(v) => setD({ ...d, address: v })}
            multiline
            hint="Printed on quotes and invoices."
          />
          <LabeledField
            label={usNow ? 'Base ZIP code' : 'Base postcode'}
            optional
            value={d.postcode}
            onChangeText={(v) => setD({ ...d, postcode: v.toUpperCase() })}
            autoCapitalize="characters"
            keyboardType={usNow ? 'number-pad' : 'default'}
            hint="Where your day starts, for drive times."
          />
        </View>
        {isUS !== usNow && (
          <Text className="text-secondary text-[13px] mx-1 mt-4">
            Changing country switches money, tax and wording to {usNow ? 'the US' : 'the UK'}. Prices you’ve set yourself stay.
          </Text>
        )}
      </ScrollView>
      <ModalFooter>
        <PrimaryButton label="Save" onPress={save} disabled={!changed} />
      </ModalFooter>
    </>
  );
}

// ── Getting paid (Save) ────────────────────────────────────────────────────────

function PayPage({ onDone }: { onDone: () => void }) {
  const settings = useSettings();
  const isUS = useRegion().country === 'US';
  const updateSettings = useTradeStore((s) => s.updateSettings);
  const [details, setDetails] = useState(settings.paymentDetails);
  const [days, setDays] = useState(settings.paymentTermsDays ?? 14);
  const changed = details !== settings.paymentDetails || days !== settings.paymentTermsDays;
  const options = [7, 14, 30].includes(days) ? [7, 14, 30] : [7, 14, 30, days].sort((a, b) => a - b);
  return (
    <>
      <ScrollView
        className="flex-1"
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
        contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
      >
        <LabeledField
          label="How customers pay you"
          value={details}
          onChangeText={setDetails}
          multiline
          style={{ minHeight: 120, paddingTop: 12, textAlignVertical: 'top' }}
          hint={
            isUS
              ? 'For example: Zelle, Venmo, or checks payable to your business. Printed on every invoice.'
              : 'For example: bank name, account name, sort code and account number. Printed on every invoice.'
          }
        />
        <View className="mt-6">
          <SectionHeader title="Payment due" />
          <Segmented
            options={options.map((n) => ({ key: String(n), label: `${n} days` }))}
            value={String(days)}
            onChange={(k) => setDays(Number(k))}
          />
          <Text className="text-secondary text-[13px] mx-1 mt-2">
            Invoices show the due date. Unpaid ones count as overdue after it.
          </Text>
        </View>
      </ScrollView>
      <ModalFooter>
        <PrimaryButton
          label="Save"
          disabled={!changed}
          onPress={async () => {
            updateSettings({ paymentDetails: details.trim(), paymentTermsDays: days });
            await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            toast('Payment details saved');
            onDone();
          }}
        />
      </ModalFooter>
    </>
  );
}

// ── Prices and tax (saves as you go) ───────────────────────────────────────────

function PricesPage() {
  const settings = useSettings();
  const isUS = useRegion().country === 'US';
  const pricingPresets = usePricingPresets();
  const set = useTradeStore((s) => s.updateSettings);
  const updatePricingPreset = useTradeStore((s) => s.updatePricingPreset);
  return (
    <ScrollView
      className="flex-1"
      keyboardShouldPersistTaps="handled"
      automaticallyAdjustKeyboardInsets
      contentContainerStyle={{ padding: 16, paddingBottom: 48 }}
    >
      <SectionHeader title="Rates" />
      <Group className="mb-8">
        <NumberFieldRow
          label="Hourly rate"
          prefix={currencySymbol()}
          value={settings.hourlyRate}
          onChangeNumber={(n) => set({ hourlyRate: n })}
          width="w-20"
        />
        <RowDivider />
        <NumberFieldRow
          label="Minimum charge"
          prefix={currencySymbol()}
          value={settings.minimumCharge}
          onChangeNumber={(n) => set({ minimumCharge: n })}
          width="w-20"
        />
        <RowDivider />
        <NumberFieldRow
          label="Urgent jobs"
          hint="1.5 adds 50%"
          suffix="×"
          value={settings.urgentMultiplier}
          fallback={1}
          onChangeNumber={(n) => set({ urgentMultiplier: n })}
          width="w-16"
        />
        <RowDivider />
        <NumberFieldRow
          label="Emergency jobs"
          hint="2 doubles the price"
          suffix="×"
          value={settings.emergencyMultiplier}
          fallback={1}
          onChangeNumber={(n) => set({ emergencyMultiplier: n })}
          width="w-16"
        />
        <RowDivider />
        <NumberFieldRow
          label="Travel"
          suffix="per mile"
          prefix={currencySymbol()}
          value={settings.travelRatePerMile}
          onChangeNumber={(n) => set({ travelRatePerMile: n })}
          width="w-14"
        />
      </Group>

      <SectionHeader title="Job prices" />
      <Group className="mb-8">
        {pricingPresets
          .filter((p) => p.type !== 'emergency')
          .map((preset, i) => (
            <View key={preset.type}>
              {i > 0 && <RowDivider />}
              <NumberFieldRow
                label={preset.label}
                prefix={currencySymbol()}
                value={preset.basePrice}
                onChangeNumber={(n) => updatePricingPreset(preset.type, { basePrice: n })}
                width="w-20"
              />
            </View>
          ))}
      </Group>

      <SectionHeader title={isUS ? 'Tax' : 'Tax and VAT'} />
      <Group className="mb-2">
        {isUS ? (
          <>
            <Text className="text-secondary text-[13px] px-4 pt-3 pb-1">Filing status</Text>
            {FILING_STATUSES.map((f, i) => (
              <View key={f.key}>
                {i > 0 && <RowDivider />}
                <ChoiceRow
                  label={f.label}
                  selected={(settings.usFilingStatus ?? 'single') === f.key}
                  onPress={() => set({ usFilingStatus: f.key })}
                />
              </View>
            ))}
            <RowDivider />
          </>
        ) : (
          <>
            <ToggleRow label="VAT registered" value={settings.vatRegistered} onValueChange={(v) => set({ vatRegistered: v })} />
            {settings.vatRegistered && (
              <>
                <RowDivider />
                <FieldRow
                  label="VAT number"
                  value={settings.vatNumber}
                  onChangeText={(v) => set({ vatNumber: v })}
                  placeholder="Add"
                  width="w-36"
                />
                <RowDivider />
                <NumberFieldRow
                  label="VAT rate"
                  suffix="%"
                  value={settings.vatRate}
                  onChangeNumber={(n) => set({ vatRate: n })}
                  width="w-14"
                />
                <RowDivider />
                <ToggleRow
                  label="Flat Rate Scheme"
                  hint="Off means standard VAT accounting"
                  value={settings.vatScheme === 'flat_rate'}
                  onValueChange={(v) => set({ vatScheme: v ? 'flat_rate' : 'standard' })}
                />
                {settings.vatScheme === 'flat_rate' && (
                  <>
                    <RowDivider />
                    <NumberFieldRow
                      label="Flat rate"
                      suffix="%"
                      value={settings.vatFlatRatePercent}
                      onChangeNumber={(n) => set({ vatFlatRatePercent: n })}
                      width="w-14"
                    />
                  </>
                )}
              </>
            )}
            <RowDivider />
            <ToggleRow
              label="CIS registered"
              hint="Construction Industry Scheme"
              value={settings.cisRegistered}
              onValueChange={(v) => set({ cisRegistered: v })}
            />
            {settings.cisRegistered && (
              <>
                <RowDivider />
                <NumberFieldRow
                  label="CIS deduction"
                  hint="20% registered, 30% unregistered"
                  suffix="%"
                  value={settings.cisRate ?? 20}
                  onChangeNumber={(n) => set({ cisRate: n })}
                  width="w-14"
                />
              </>
            )}
            <RowDivider />
            <NumberFieldRow
              label="Personal Allowance"
              hint="Standard is £12,570"
              prefix={currencySymbol()}
              decimal={false}
              value={settings.personalAllowance}
              onChangeNumber={(n) => set({ personalAllowance: n })}
              width="w-24"
            />
            <RowDivider />
          </>
        )}
        <ToggleRow
          label="This is my only income"
          value={settings.onlyIncomeSource}
          onValueChange={(v) => set({ onlyIncomeSource: v })}
        />
        {!settings.onlyIncomeSource && (
          <>
            <RowDivider />
            <NumberFieldRow
              label="Other income a year"
              hint={isUS ? 'Wages, pension, rent' : 'Salary, pension, rent'}
              prefix={currencySymbol()}
              decimal={false}
              value={settings.otherAnnualIncome}
              onChangeNumber={(n) => set({ otherAnnualIncome: n })}
              width="w-24"
            />
          </>
        )}
        <RowDivider />
        <View className="flex-row items-center px-4 min-h-[52px] py-2">
          <Text className="flex-1 text-fg text-base">Mileage</Text>
          <Text className="text-secondary text-sm text-right">
            {isUS
              ? `IRS rate: ${cents(mileageRate(new Date(2026, 0, 1)))} a mile,\n${cents(mileageRate(new Date(2026, 6, 1)))} from 1 July`
              : 'HMRC rates: 45p a mile,\n25p after 10,000 miles'}
          </Text>
        </View>
      </Group>
      <Text className="text-secondary text-[13px] mx-1">Changes save as you type.</Text>
    </ScrollView>
  );
}

// ── Diary / Schedule: area, hours, calendar ────────────────────────────────────

function DiaryPage() {
  const settings = useSettings();
  const set = useTradeStore((s) => s.updateSettings);
  const jobs = useJobs();
  const getCustomer = useTradeStore((s) => s.getCustomer);
  const [calendarEnabled, setCalendarEnabled] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [modal, setModal] = useState<{ title: string; message: string; variant?: 'success' | 'warning' } | null>(null);

  // The switch shows what's really set up on the phone, not what was last tapped.
  useEffect(() => {
    hasCalendarPermissions().then((allowed) => setCalendarEnabled(allowed && !useTradeStore.getState().settings.calendarSyncOff));
  }, []);

  const handleCalendarToggle = async (value: boolean) => {
    if (!value) {
      set({ calendarSyncOff: true });
      setCalendarEnabled(false);
      return;
    }
    if (!(await requestCalendarPermissions())) {
      setModal({
        title: 'Calendar access needed',
        message: 'Allow Tradie to use your calendar in the iPhone Settings app, then try again.',
        variant: 'warning',
      });
      return;
    }
    set({ calendarSyncOff: false });
    setCalendarEnabled(true);
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setSyncing(true);
    const { synced } = await syncAllJobsToCalendar(jobs, getCustomer, (job) => jobName(job, settings.trade));
    setSyncing(false);
    if (synced > 0) toast(`${synced} ${synced === 1 ? 'job' : 'jobs'} added to your calendar`);
  };

  return (
    <ScrollView className="flex-1" keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 16, paddingBottom: 48 }}>
      <SectionHeader title="Area and hours" />
      <Group className="mb-2">
        <NumberFieldRow
          label="Distance you’ll travel"
          suffix="miles"
          decimal={false}
          value={settings.serviceRadiusMiles}
          onChangeNumber={(n) => set({ serviceRadiusMiles: n })}
          width="w-12"
        />
        <RowDivider />
        <FieldRow
          label="Start of day"
          value={settings.workingHours.start}
          onChangeText={(v) => set({ workingHours: { ...settings.workingHours, start: v } })}
          placeholder="08:00"
          keyboardType="numbers-and-punctuation"
          width="w-16"
        />
        <RowDivider />
        <FieldRow
          label="End of day"
          value={settings.workingHours.end}
          onChangeText={(v) => set({ workingHours: { ...settings.workingHours, end: v } })}
          placeholder="18:00"
          keyboardType="numbers-and-punctuation"
          width="w-16"
        />
      </Group>
      <Text className="text-secondary text-[13px] mx-1 mb-8">Suggest times only offers slots inside these hours.</Text>

      <SectionHeader title="Calendar" />
      <Group className="mb-2">
        <ToggleRow
          label="Add jobs to my calendar"
          hint={syncing ? 'Adding jobs…' : 'Booked jobs appear in the Calendar app'}
          value={calendarEnabled}
          onValueChange={handleCalendarToggle}
          disabled={syncing}
        />
      </Group>
      <Text className="text-secondary text-[13px] mx-1">Changes save as you go.</Text>
      {modal && (
        <ConfirmModal
          visible
          title={modal.title}
          message={modal.message}
          variant={modal.variant}
          onDismiss={() => setModal(null)}
        />
      )}
    </ScrollView>
  );
}

// ── Reminders: each one switchable ─────────────────────────────────────────────

function RemindersPage() {
  const settings = useSettings();
  const set = useTradeStore((s) => s.updateSettings);
  const prefs = reminderPrefs(settings);
  const [modal, setModal] = useState(false);
  const change = async (key: keyof typeof prefs, value: boolean) => {
    if (value && !(await ensureNotificationPermission())) {
      setModal(true);
      return;
    }
    set({ reminders: { ...settings.reminders, [key]: value } });
    // The evening-before reminder is the daily 6pm nudge about tomorrow's jobs.
    if (key === 'jobTomorrow') await setDailyReminder(value);
  };
  const rows: { key: keyof typeof prefs; label: string; hint: string }[] = [
    { key: 'quoteNoReply', label: 'Quote with no reply', hint: 'After 3 days, so you can send a reminder' },
    { key: 'invoiceOverdue', label: 'Invoice overdue', hint: 'The day it goes past its due date' },
    { key: 'jobTomorrow', label: 'Jobs tomorrow', hint: 'At 6pm the evening before' },
    { key: 'renewals', label: 'Insurance and licences', hint: '30 days and 7 days before they run out' },
  ];
  return (
    <ScrollView className="flex-1" contentContainerStyle={{ padding: 16, paddingBottom: 48 }}>
      <Group className="mb-2">
        {rows.map((r, i) => (
          <View key={r.key}>
            {i > 0 && <RowDivider />}
            <ToggleRow label={r.label} hint={r.hint} value={prefs[r.key]} onValueChange={(v) => change(r.key, v)} />
          </View>
        ))}
      </Group>
      <Text className="text-secondary text-[13px] mx-1">
        Reminders come from this phone. Nothing is sent to your customers unless you send it.
      </Text>
      <ConfirmModal
        visible={modal}
        title="Notifications are off"
        message="Allow notifications for Tradie in the iPhone Settings app, then try again."
        variant="warning"
        onDismiss={() => setModal(false)}
      />
    </ScrollView>
  );
}

// ── Appearance ─────────────────────────────────────────────────────────────────

function AppearancePage() {
  const settings = useSettings();
  const set = useTradeStore((s) => s.updateSettings);
  const value = settings.appearance ?? 'automatic';
  return (
    <ScrollView className="flex-1" contentContainerStyle={{ padding: 16, paddingBottom: 48 }}>
      <Group className="mb-2">
        {(
          [
            ['automatic', 'Automatic'],
            ['light', 'Light'],
            ['dark', 'Dark'],
          ] as const
        ).map(([k, label], i) => (
          <View key={k}>
            {i > 0 && <RowDivider />}
            <ChoiceRow label={label} selected={value === k} onPress={() => set({ appearance: k })} />
          </View>
        ))}
      </Group>
      <Text className="text-secondary text-[13px] mx-1">
        Automatic follows your iPhone’s light or dark setting. Changes straight away.
      </Text>
    </ScrollView>
  );
}

// ── Plan ───────────────────────────────────────────────────────────────────────

function PlanPage() {
  const router = useRouter();
  const t = useTheme();
  const { isPro } = useProAccess();
  const isUS = useRegion().country === 'US';
  const refreshPro = useRefreshPro();
  const [restoring, setRestoring] = useState(false);
  const restore = async () => {
    setRestoring(true);
    const result = await restorePurchases();
    setRestoring(false);
    if (!result.ok) return toast('Couldn’t check. Try again with a connection.');
    await refreshPro();
    toast(result.data.entitlements.active.pro ? 'Pro restored' : 'No Tradie Pro on this Apple ID');
  };
  return (
    <ScrollView className="flex-1" contentContainerStyle={{ padding: 16, paddingBottom: 48 }}>
      {isPro ? (
        <>
          <Group className="p-4 mb-3">
            <Text className="text-link text-[13px] font-extrabold tracking-[1.5px]">TRADIE PRO</Text>
            <Text className="text-fg text-[20px] font-semibold mt-1">Everything unlocked</Text>
            <Text className="text-secondary text-[15px] mt-1">Unlimited invoices, tax set-aside, expenses and exports.</Text>
          </Group>
          <Group>
            <LinkRow
              label="Manage subscription"
              external
              onPress={() => Linking.openURL('https://apps.apple.com/account/subscriptions')}
            />
          </Group>
        </>
      ) : (
        <>
          <Group className="p-4 mb-6">
            <Text className="text-fg text-[20px] font-semibold">Free plan</Text>
            <Text className="text-secondary text-[15px] mt-1">Unlimited jobs, quotes and booking. 3 invoices a month.</Text>
          </Group>
          <SectionHeader title="Pro adds" />
          <Group className="mb-6">
            {[
              'Unlimited invoices',
              isUS ? 'Tax set-aside (IRS)' : 'Tax set-aside and VAT tracker',
              'Expenses and receipts',
              'Tax-year export for your accountant',
            ].map((x, i) => (
              <View key={x}>
                {i > 0 && <RowDivider />}
                <View className="flex-row items-center px-4 min-h-[48px]">
                  <Check size={18} color={t.link} strokeWidth={2.25} />
                  <Text className="text-fg text-base ml-3">{x}</Text>
                </View>
              </View>
            ))}
          </Group>
          <PrimaryButton label="See Pro prices" onPress={() => router.push('/paywall')} />
          <Pressable
            onPress={restore}
            disabled={restoring}
            className="min-h-[48px] items-center justify-center mt-1"
            accessibilityRole="button"
          >
            <Text className="text-link text-base font-semibold">{restoring ? 'Checking…' : 'Restore purchase'}</Text>
          </Pressable>
        </>
      )}
    </ScrollView>
  );
}

// ── Sign in ────────────────────────────────────────────────────────────────────

function SignInPage({ onDone }: { onDone: () => void }) {
  const account = useAccount();
  const settings = useSettings();
  const clearAllData = useTradeStore((s) => s.clearAllData);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState(false);
  return (
    <ScrollView className="flex-1" contentContainerStyle={{ padding: 16, paddingBottom: 48 }}>
      {account ? (
        <>
          <Group className="mb-6">
            <View className="px-4 py-3.5">
              <Text className="text-fg text-[17px] font-semibold">{account.name || settings.ownerName || 'Signed in'}</Text>
              <Text className="text-secondary text-sm mt-0.5">
                {account.email ? `${account.email} · Apple ID` : 'Signed in with Apple'}
              </Text>
            </View>
          </Group>
          <Text className="text-secondary text-[13px] mx-1 mb-6">
            Signing in keeps Pro linked to you and turns on drive times. Your jobs stay on this phone.
          </Text>
          <Group className="mb-2">
            <LinkRow
              label="Sign out"
              onPress={async () => {
                await signOut();
                toast('Signed out');
                onDone();
              }}
            />
          </Group>
          <Group className="mt-6">
            <LinkRow label={deleting ? 'Deleting…' : 'Delete account'} destructive onPress={() => setConfirmDelete(true)} />
          </Group>
          <Text className="text-secondary text-[13px] mx-1 mt-2">
            Removes your Tradie account and Sign in with Apple, and the data on this phone. Different from “Delete all my data”,
            which only clears this phone.
          </Text>
        </>
      ) : (
        <>
          <Text className="text-fg text-[17px] leading-6 mb-2">Signing in keeps Pro linked to you and turns on drive times.</Text>
          <Text className="text-secondary text-[15px] leading-5 mb-6">
            Your jobs stay on this phone either way. To move them to a new phone, restore it from your iPhone backup.
          </Text>
          <AppleSignInButton label="signIn" onSignedIn={onDone} />
        </>
      )}
      <ConfirmModal
        visible={confirmDelete}
        title="Delete your account?"
        message="This removes your Tradie account and Sign in with Apple, and deletes every job, customer, invoice and expense on this phone. If you pay for Pro, cancel it in your Apple ID settings too: deleting the account doesn’t stop the subscription."
        confirmText="Delete account"
        cancelText="Cancel"
        variant="error"
        onConfirm={async () => {
          setDeleting(true);
          try {
            if (await deleteAccount()) {
              await cancelAllReminders();
              clearAllData();
              toast('Account deleted');
              onDone();
            }
          } catch (e) {
            if (__DEV__) console.error('Delete account failed:', e);
            setError(true);
          } finally {
            setDeleting(false);
          }
        }}
        onCancel={() => {}}
        onDismiss={() => setConfirmDelete(false)}
      />
      <ConfirmModal
        visible={error}
        title="Couldn’t delete your account"
        message="Check your connection and try again."
        variant="error"
        onDismiss={() => setError(false)}
      />
    </ScrollView>
  );
}

// ── Help and legal ─────────────────────────────────────────────────────────────

function HelpPage() {
  const set = useTradeStore((s) => s.updateSettings);
  return (
    <ScrollView className="flex-1" contentContainerStyle={{ padding: 16, paddingBottom: 48 }}>
      <Group className="mb-6">
        <LinkRow
          label="Contact support"
          value={SUPPORT_EMAIL}
          external
          onPress={() => Linking.openURL(`mailto:${SUPPORT_EMAIL}`)}
        />
        <RowDivider />
        <LinkRow
          label="Privacy policy"
          external
          onPress={() => Linking.openURL('https://omniacollective.github.io/tradie-legal/privacy.html')}
        />
        <RowDivider />
        <LinkRow
          label="Terms of use"
          external
          onPress={() => Linking.openURL('https://omniacollective.github.io/tradie-legal/terms.html')}
        />
      </Group>
      <Group>
        <LinkRow
          label="Show tips again"
          onPress={() => {
            set({ tipsSeen: [] });
            toast('Tips will show again');
          }}
        />
      </Group>
    </ScrollView>
  );
}

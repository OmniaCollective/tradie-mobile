import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, Linking, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Database, Trash2 } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import Constants from 'expo-constants';
import {
  useTradeStore,
  useSettings,
  usePricingPresets,
  useJobs,
  useRegion,
  type JobType,
  type USFilingStatus,
} from '@/lib/store';
import { COUNTRY_OPTIONS } from '@/lib/region';
import { mileageRate } from '@/lib/data/usTax2026';
import { requestCalendarPermissions, hasCalendarPermissions, syncAllJobsToCalendar } from '@/lib/calendarSync';
import { getJobTypeLabel } from '@/lib/store';
import { isDailyReminderOn, setDailyReminder, cancelAllReminders } from '@/lib/notifications';
import { useProAccess } from '@/lib/useProAccess';
import { useAccount, signOut, deleteAccount } from '@/lib/auth';
import { AppleSignInButton } from '@/components/AppleSignInButton';
import { ConfirmModal } from '@/components/ConfirmModal';
import { RenewalsSection } from '@/components/Renewals';
import { cn } from '@/lib/cn';
import {
  Group,
  RowDivider,
  SectionHeader,
  FieldRow,
  NumberFieldRow,
  ToggleRow,
  LinkRow,
  Disclosure,
  Segmented,
  ChoiceRow,
  TextAreaRow,
} from '@/components/ui';
import { currencySymbol } from '@/lib/money';

type Section = 'rates' | 'prices' | 'tax' | 'area' | 'automation';

const SUPPORT_EMAIL = 'paul@builtbyomnia.com';

const FILING_STATUSES: { key: USFilingStatus; label: string }[] = [
  { key: 'single', label: 'Single' },
  { key: 'married_joint', label: 'Married filing jointly' },
  { key: 'head_of_household', label: 'Head of household' },
];

/** 72.5¢ */
const cents = (dollars: number) => `${+(dollars * 100).toFixed(1)}¢`;

export default function AccountScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const settings = useSettings();
  const pricingPresets = usePricingPresets();
  const jobs = useJobs();
  const { isPro } = useProAccess();
  const account = useAccount();
  const region = useRegion();
  const isUS = region.country === 'US';
  const [confirmDeleteAccount, setConfirmDeleteAccount] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const updateSettings = useTradeStore((s) => s.updateSettings);
  const setCountry = useTradeStore((s) => s.setCountry);
  const updatePricingPreset = useTradeStore((s) => s.updatePricingPreset);
  const getCustomer = useTradeStore((s) => s.getCustomer);
  const loadSampleData = useTradeStore((s) => s.loadSampleData);
  const clearAllData = useTradeStore((s) => s.clearAllData);

  const [open, setOpen] = useState<Section | null>(null);
  const [calendarEnabled, setCalendarEnabled] = useState(false);
  const [dailyReminders, setDailyReminders] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [modal, setModal] = useState<{
    title: string;
    message: string;
    variant?: 'default' | 'success' | 'error' | 'warning';
  } | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);

  // Both switches show what's really set up on the phone, not what was last tapped.
  useEffect(() => {
    hasCalendarPermissions().then((allowed) => setCalendarEnabled(allowed && !useTradeStore.getState().settings.calendarSyncOff));
    isDailyReminderOn().then(setDailyReminders);
  }, []);

  const toggle = (s: Section) => setOpen((cur) => (cur === s ? null : s));
  const set = updateSettings;

  const handleCalendarToggle = async (value: boolean) => {
    if (!value) {
      set({ calendarSyncOff: true });
      setCalendarEnabled(false);
      return;
    }
    const granted = await requestCalendarPermissions();
    if (!granted) {
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
    const { synced } = await syncAllJobsToCalendar(jobs, getCustomer, (type) => getJobTypeLabel(settings.trade, type as JobType));
    setSyncing(false);
    if (synced > 0) {
      setModal({
        title: 'Calendar synced',
        message: `${synced} ${synced === 1 ? 'job' : 'jobs'} added to your calendar.`,
        variant: 'success',
      });
    }
  };

  const handleDailyReminders = async (value: boolean) => {
    const on = await setDailyReminder(value);
    setDailyReminders(on);
    if (!value) return;
    if (!on) {
      setModal({
        title: 'Notifications are off',
        message: 'Allow notifications for Tradie in the iPhone Settings app, then try again.',
        variant: 'warning',
      });
      return;
    }
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setModal({
      title: 'Daily reminders on',
      message: 'At 6pm you’ll get a nudge to message customers about tomorrow’s jobs.',
      variant: 'success',
    });
  };

  return (
    <>
      <ScrollView
        className="flex-1 bg-bg"
        automaticallyAdjustKeyboardInsets
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingTop: insets.top + 16, paddingBottom: 32, paddingHorizontal: 16 }}
      >
        <Text className="text-fg text-[28px] font-bold tracking-tight mb-5">Account</Text>

        {/* Sign-in */}
        {account ? (
          <Group className="mb-4">
            <View className="px-4 py-3.5">
              <Text className="text-fg text-[17px] font-semibold">{account.name || settings.ownerName || 'Signed in'}</Text>
              <Text className="text-secondary text-sm mt-0.5">
                {account.email ? `${account.email} · Apple ID` : 'Signed in with Apple'}
              </Text>
            </View>
            <RowDivider />
            <LinkRow label="Sign out" onPress={() => signOut()} />
            <RowDivider />
            <LinkRow
              label={deleting ? 'Deleting…' : 'Delete account'}
              destructive
              onPress={() => setConfirmDeleteAccount(true)}
            />
          </Group>
        ) : (
          <Group className="mb-4 p-4">
            <Text className="text-fg text-[17px] font-semibold mb-1">Sign in</Text>
            <Text className="text-secondary text-[15px] leading-5 mb-4">
              Keeps Pro on a new phone and turns on voice jobs and drive times. Your jobs stay on this phone.
            </Text>
            <AppleSignInButton label="signIn" />
          </Group>
        )}

        {/* Plan */}
        <Group className="mb-8">
          {isPro ? (
            <>
              <View className="px-4 py-3.5">
                <Text className="text-fg text-[17px] font-semibold">Tradie Pro</Text>
                <Text className="text-link text-sm mt-0.5">Active — everything unlocked</Text>
              </View>
              <RowDivider />
              <LinkRow
                label="Manage subscription"
                external
                onPress={() => Linking.openURL('https://apps.apple.com/account/subscriptions')}
              />
            </>
          ) : (
            <Pressable
              onPress={() => router.push('/paywall')}
              className="px-4 py-3.5 active:opacity-70"
              accessibilityRole="button"
            >
              <View className="flex-row items-center justify-between">
                <Text className="text-fg text-[17px] font-semibold">Free plan</Text>
                <Text className="text-link text-[15px] font-semibold">Upgrade</Text>
              </View>
              <Text className="text-secondary text-sm mt-0.5">
                Pro adds unlimited invoices, the tax tracker, expenses and voice jobs.
              </Text>
            </Pressable>
          )}
        </Group>

        {/* Business */}
        <SectionHeader title="Your business" />
        <Group className="mb-8">
          <View className="flex-row items-center px-4 min-h-[52px] py-2">
            <Text className="flex-1 text-fg text-base">Country</Text>
            <Segmented options={COUNTRY_OPTIONS} value={region.country} onChange={setCountry} className="w-32 bg-bg" />
          </View>
          <RowDivider />
          <FieldRow
            label="Business name"
            value={settings.businessName}
            onChangeText={(v) => set({ businessName: v })}
            placeholder="Required for invoices"
          />
          <RowDivider />
          <FieldRow
            label="Your name"
            value={settings.ownerName}
            onChangeText={(v) => set({ ownerName: v })}
            placeholder="First and last"
          />
          <RowDivider />
          <FieldRow
            label="Phone"
            value={settings.phone}
            onChangeText={(v) => set({ phone: v })}
            placeholder={isUS ? '(555) 555-0100' : '07700 000000'}
            keyboardType="phone-pad"
          />
          <RowDivider />
          <FieldRow
            label="Email"
            value={settings.email}
            onChangeText={(v) => set({ email: v })}
            placeholder="you@example.com"
            keyboardType="email-address"
            autoCapitalize="none"
            width="w-48"
          />
          <RowDivider />
          <TextAreaRow
            label="Business address"
            value={settings.address}
            onChangeText={(v) => set({ address: v })}
            placeholder={isUS ? '123 Main Street, Springfield, IL' : '12 High Street, London'}
          />
          <RowDivider />
          <FieldRow
            label={isUS ? 'Base ZIP code' : 'Base postcode'}
            value={settings.postcode}
            onChangeText={(v) => set({ postcode: v.toUpperCase() })}
            placeholder={isUS ? '94103' : 'SW1A 1AA'}
            autoCapitalize="characters"
            keyboardType={isUS ? 'number-pad' : 'default'}
            width="w-28"
          />
        </Group>

        {/* Getting paid */}
        <SectionHeader title="Getting paid" />
        <Group className="mb-2">
          <TextAreaRow
            label="Payment details"
            hint="Printed on every invoice"
            value={settings.paymentDetails}
            onChangeText={(v) => set({ paymentDetails: v })}
            placeholder={
              isUS
                ? 'Zelle: you@example.com\nChecks payable to Your Business'
                : 'Bank: Your Bank\nName: Your Business\nSort code: 00-00-00\nAccount: 12345678'
            }
          />
          <RowDivider />
          <NumberFieldRow
            label="Payment due"
            hint="Days after you send the invoice"
            suffix="days"
            decimal={false}
            value={settings.paymentTermsDays}
            fallback={14}
            onChangeNumber={(n) => set({ paymentTermsDays: n })}
            width="w-12"
          />
        </Group>
        <Text className="text-secondary text-[13px] mx-1 mb-8">
          Invoices show the due date, and unpaid ones count as overdue after it.
        </Text>

        {/* Insurance and licences */}
        <RenewalsSection />

        {/* Pricing and tax */}
        <SectionHeader title="Pricing and tax" />
        <View className="gap-3 mb-8">
          <Disclosure
            title="Rates"
            summary={`${currencySymbol()}${settings.hourlyRate}/hour`}
            open={open === 'rates'}
            onToggle={() => toggle('rates')}
          >
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
          </Disclosure>

          <Disclosure
            title="Job prices"
            summary={`${pricingPresets.length} job types`}
            open={open === 'prices'}
            onToggle={() => toggle('prices')}
          >
            {pricingPresets.map((preset, i) => (
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
          </Disclosure>

          <Disclosure
            title={isUS ? 'Tax' : 'Tax and VAT'}
            summary={
              isUS
                ? FILING_STATUSES.find((f) => f.key === (settings.usFilingStatus ?? 'single'))!.label
                : settings.vatRegistered
                  ? 'VAT registered'
                  : 'Not VAT registered'
            }
            open={open === 'tax'}
            onToggle={() => toggle('tax')}
          >
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
                <ToggleRow
                  label="VAT registered"
                  value={settings.vatRegistered}
                  onValueChange={(v) => set({ vatRegistered: v })}
                />
                {settings.vatRegistered && (
                  <>
                    <RowDivider />
                    <FieldRow
                      label="VAT number"
                      value={settings.vatNumber}
                      onChangeText={(v) => set({ vatNumber: v })}
                      placeholder="GB 123 4567 89"
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
          </Disclosure>

          <Disclosure
            title="Area and hours"
            summary={`${settings.serviceRadiusMiles} miles`}
            open={open === 'area'}
            onToggle={() => toggle('area')}
          >
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
          </Disclosure>

          <Disclosure title="Calendar and reminders" open={open === 'automation'} onToggle={() => toggle('automation')}>
            <ToggleRow
              label="Add jobs to my calendar"
              hint={syncing ? 'Adding jobs…' : 'Scheduled jobs appear in the Calendar app'}
              value={calendarEnabled}
              onValueChange={handleCalendarToggle}
              disabled={syncing}
            />
            <RowDivider />
            <ToggleRow
              label="Daily reminder"
              hint="6pm nudge to message tomorrow’s customers"
              value={dailyReminders}
              onValueChange={handleDailyReminders}
            />
          </Disclosure>
        </View>

        {/* About */}
        <SectionHeader title="About" />
        <Group className="mb-8">
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
          <RowDivider />
          <LinkRow
            label="Contact support"
            value={SUPPORT_EMAIL}
            external
            onPress={() => Linking.openURL(`mailto:${SUPPORT_EMAIL}`)}
          />
        </Group>

        {/* Data */}
        <Group className="mb-8">
          {__DEV__ && (
            <>
              <LinkRow
                label="Load sample data (dev only)"
                icon={Database}
                onPress={() => {
                  loadSampleData();
                  setModal({
                    title: 'Sample data loaded',
                    message: 'Demo jobs, invoices and expenses added.',
                    variant: 'success',
                  });
                }}
              />
              <RowDivider />
            </>
          )}
          <LinkRow label="Delete all my data" icon={Trash2} destructive onPress={() => setConfirmClear(true)} />
        </Group>

        <View className="items-center">
          <Text className="text-link text-[15px] font-extrabold tracking-[2px]">TRADIE</Text>
          <Text className={cn('text-secondary text-[13px] mt-1')}>Version {Constants.expoConfig?.version}</Text>
        </View>
      </ScrollView>

      {modal && (
        <ConfirmModal
          visible={!!modal}
          title={modal.title}
          message={modal.message}
          variant={modal.variant}
          onDismiss={() => setModal(null)}
        />
      )}

      <ConfirmModal
        visible={confirmDeleteAccount}
        title="Delete your account?"
        message="This removes your Tradie account and Sign in with Apple, and deletes every job, customer, invoice and expense on this phone. If you pay for Pro, cancel it in your Apple ID settings too — deleting the account doesn’t stop the subscription."
        confirmText="Delete account"
        cancelText="Cancel"
        variant="error"
        onConfirm={async () => {
          setDeleting(true);
          try {
            if (await deleteAccount()) {
              await cancelAllReminders();
              clearAllData();
            }
          } catch (e) {
            if (__DEV__) console.error('Delete account failed:', e);
            setModal({
              title: 'Couldn’t delete your account',
              message: 'Check your connection and try again.',
              variant: 'error',
            });
          } finally {
            setDeleting(false);
          }
        }}
        onCancel={() => {}}
        onDismiss={() => setConfirmDeleteAccount(false)}
      />

      <ConfirmModal
        visible={confirmClear}
        title="Delete all your data?"
        message="Every job, customer, invoice and expense on this phone will be deleted. This can’t be undone."
        confirmText="Delete everything"
        cancelText="Cancel"
        variant="error"
        onConfirm={async () => {
          await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          await cancelAllReminders();
          clearAllData();
        }}
        onCancel={() => {}}
        onDismiss={() => setConfirmClear(false)}
      />
    </>
  );
}

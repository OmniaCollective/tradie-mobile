import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, Pressable, TextInput, Image, Platform } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Check, Camera, ImageIcon, Calendar, Tag, Briefcase } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useTradeStore, useJobs, type ExpenseCategory, EXPENSE_CATEGORY_LABELS } from '@/lib/store';
import { getJobTypeLabel } from '@/lib/store';
import { formatDateObjLong, toDateKey, parseDate } from '@/lib/dates';
import { formatMoney, currencySymbol } from '@/lib/money';
import { useProAccess } from '@/lib/useProAccess';
import { useTheme } from '@/lib/theme';
import { cn } from '@/lib/cn';
import { Group, RowDivider, LinkRow, FieldRow, Sheet } from '@/components/ui';

const CATEGORIES: ExpenseCategory[] = [
  'materials',
  'tools_equipment',
  'vehicle_mileage',
  'subcontractor',
  'workwear_ppe',
  'phone_internet',
  'insurance',
  'training',
  'home_office',
  'other',
];

// HMRC approved mileage rates for cars and vans
const MILEAGE_RATE_FIRST_10K = 0.45;
const MILEAGE_RATE_AFTER_10K = 0.25;

function taxYearStart(now = new Date()): Date {
  const afterApril6 = now.getMonth() > 3 || (now.getMonth() === 3 && now.getDate() >= 6);
  return new Date(afterApril6 ? now.getFullYear() : now.getFullYear() - 1, 3, 6);
}

/** The big amount box hugs its digits so it stays centred and never clips. */
const bigInputWidth = (text: string) => Math.max(48, text.length * 24 + 12);

async function saveReceipt(uri: string): Promise<string> {
  const destDir = `${FileSystem.documentDirectory}receipts/`;
  await FileSystem.makeDirectoryAsync(destDir, { intermediates: true });
  const destUri = `${destDir}receipt_${Date.now()}.jpg`;
  await FileSystem.copyAsync({ from: uri, to: destUri });
  return destUri;
}

export default function AddExpenseScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const t = useTheme();
  const { jobId: routeJobId } = useLocalSearchParams<{ jobId?: string }>();
  const addExpense = useTradeStore((s) => s.addExpense);
  const expenses = useTradeStore((s) => s.expenses);
  const getCustomer = useTradeStore((s) => s.getCustomer);
  const settings = useTradeStore((s) => s.settings);
  const jobs = useJobs();
  const { isPro, isLoading } = useProAccess();

  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<ExpenseCategory | null>(null);
  const [date, setDate] = useState(() => new Date());
  const [showDate, setShowDate] = useState(false);
  const [picker, setPicker] = useState<'category' | 'job' | null>(null);
  const [receiptUri, setReceiptUri] = useState<string | null>(null);
  const [miles, setMiles] = useState('');
  const [businessUse, setBusinessUse] = useState('100');
  const [vatAmount, setVatAmount] = useState('');
  const [jobId, setJobId] = useState<string | null>(routeJobId || null);
  const [saving, setSaving] = useState(false);

  // Expenses are a Pro feature.
  useEffect(() => {
    if (!isLoading && !isPro) router.replace('/paywall');
  }, [isLoading, isPro, router]);

  const isMileage = category === 'vehicle_mileage';
  const num = (s: string) => parseFloat(s.replace(',', '.')) || 0;

  const mileageAmount = (() => {
    const total = num(miles);
    if (!isMileage || total <= 0) return 0;
    const start = taxYearStart();
    const usedThisYear = expenses
      .filter((e) => e.category === 'vehicle_mileage' && e.miles && parseDate(e.date) >= start)
      .reduce((sum, e) => sum + (e.miles || 0), 0);
    const at45 = Math.min(total, Math.max(0, 10000 - usedThisYear));
    return at45 * MILEAGE_RATE_FIRST_10K + (total - at45) * MILEAGE_RATE_AFTER_10K;
  })();

  const claimable =
    category === 'phone_internet' ? (num(amount) * Math.min(100, num(businessUse))) / 100 : isMileage ? mileageAmount : num(amount);
  const canSave = !!category && claimable > 0 && !saving;

  const linkableJobs = jobs
    .filter((j) => ['APPROVED', 'SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'INVOICED'].includes(j.status))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 12);
  const linkedJob = jobs.find((j) => j.id === jobId);
  const jobLabel = (id: string) => {
    const j = jobs.find((x) => x.id === id);
    if (!j) return 'Unknown job';
    return `${getJobTypeLabel(settings.trade, j.type)} · ${getCustomer(j.customerId)?.name ?? ''}`;
  };

  const pickReceipt = async (fromCamera: boolean) => {
    if (fromCamera) {
      const { granted } = await ImagePicker.requestCameraPermissionsAsync();
      if (!granted) return;
    }
    const result = fromCamera
      ? await ImagePicker.launchCameraAsync({ quality: 0.7 })
      : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.7 });
    if (!result.canceled && result.assets[0]) setReceiptUri(await saveReceipt(result.assets[0].uri));
  };

  const handleSave = async () => {
    if (!category || !canSave) return;
    setSaving(true);
    try {
      addExpense({
        amount: Math.round(claimable * 100) / 100,
        description: description.trim() || EXPENSE_CATEGORY_LABELS[category],
        category,
        date: toDateKey(date),
        receiptUri: receiptUri || undefined,
        miles: isMileage ? num(miles) || undefined : undefined,
        businessUsePercent: category === 'phone_internet' ? num(businessUse) || 100 : undefined,
        vatAmount: num(vatAmount) > 0 ? Math.round(num(vatAmount) * 100) / 100 : undefined,
        jobId: jobId || undefined,
      });
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.back();
    } catch (error) {
      if (__DEV__) console.error('Save expense error:', error);
      setSaving(false);
    }
  };

  return (
    <View className="flex-1 bg-bg">
      {/* Header */}
      <View className="flex-row items-center justify-between px-4" style={{ paddingTop: Platform.OS === 'ios' ? 12 : insets.top + 8 }}>
        <Pressable onPress={() => router.back()} hitSlop={10} className="min-h-[44px] justify-center" accessibilityRole="button">
          <Text className="text-link text-[17px]">Cancel</Text>
        </Pressable>
        <Text className="text-fg text-[17px] font-semibold">New expense</Text>
        <Pressable onPress={handleSave} disabled={!canSave} hitSlop={10} className="min-h-[44px] justify-center" accessibilityRole="button">
          <Text className={cn('text-[17px] font-semibold', canSave ? 'text-link' : 'text-secondary opacity-50')}>Save</Text>
        </Pressable>
      </View>

      <ScrollView
        className="flex-1"
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
        contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 32 }}
      >
        {/* Amount */}
        <Group className="px-4 py-5 mb-6 items-center">
          {isMileage ? (
            <>
              <View className="flex-row items-baseline">
                <TextInput
                  className="text-fg text-[40px] font-bold text-center"
                  style={{ width: bigInputWidth(miles || '0') }}
                  placeholder="0"
                  placeholderTextColor={t.secondary}
                  value={miles}
                  onChangeText={setMiles}
                  keyboardType="decimal-pad"
                  accessibilityLabel="Miles"
                  autoFocus
                />
                <Text className="text-secondary text-xl ml-2">miles</Text>
              </View>
              <Text className="text-secondary text-sm mt-1">
                {mileageAmount > 0 ? `You can claim ${formatMoney(mileageAmount)} at HMRC rates` : '45p a mile, 25p after 10,000 this tax year'}
              </Text>
            </>
          ) : (
            <>
              <View className="flex-row items-baseline">
                <Text className="text-secondary text-[32px] font-bold mr-1">{currencySymbol()}</Text>
                <TextInput
                  className="text-fg text-[40px] font-bold"
                  style={{ width: bigInputWidth(amount || '0.00') }}
                  placeholder="0.00"
                  placeholderTextColor={t.secondary}
                  value={amount}
                  onChangeText={setAmount}
                  keyboardType="decimal-pad"
                  accessibilityLabel="Amount"
                  autoFocus
                />
              </View>
              {category === 'phone_internet' && num(amount) > 0 && (
                <Text className="text-secondary text-sm mt-1">You can claim {formatMoney(claimable)}</Text>
              )}
            </>
          )}
        </Group>

        {/* Details */}
        <Group className="mb-6">
          <LinkRow icon={Tag} label="Category" value={category ? EXPENSE_CATEGORY_LABELS[category] : 'Choose'} onPress={() => setPicker('category')} />
          {category === 'phone_internet' && (
            <>
              <RowDivider />
              <FieldRow label="Business use" suffix="%" value={businessUse} onChangeText={setBusinessUse} keyboardType="number-pad" />
            </>
          )}
          {settings.vatRegistered && category && !isMileage && category !== 'phone_internet' && (
            <>
              <RowDivider />
              <FieldRow label="VAT included" hint="Reclaimable" prefix={currencySymbol()} value={vatAmount} onChangeText={setVatAmount} placeholder="0.00" keyboardType="decimal-pad" />
              {num(amount) > 0 && !vatAmount && (
                <Pressable onPress={() => setVatAmount((num(amount) - num(amount) / 1.2).toFixed(2))} className="px-4 pb-3" accessibilityRole="button">
                  <Text className="text-link text-sm font-semibold">Work out 20% VAT</Text>
                </Pressable>
              )}
            </>
          )}
          <RowDivider />
          <FieldRow label="Description" value={description} onChangeText={setDescription} placeholder="Optional" width="w-48" />
          <RowDivider />
          <LinkRow icon={Calendar} label="Date" value={formatDateObjLong(date)} onPress={() => setShowDate((v) => !v)} />
          {showDate && (
            <View className="items-center pb-2">
              <DateTimePicker
                value={date}
                mode="date"
                display={Platform.OS === 'ios' ? 'inline' : 'default'}
                maximumDate={new Date()}
                onChange={(_, d) => {
                  if (d) setDate(d);
                  if (Platform.OS === 'android') setShowDate(false);
                }}
                themeVariant={t.mode}
                accentColor={t.link}
              />
            </View>
          )}
          <RowDivider />
          <LinkRow icon={Briefcase} label="Job" value={linkedJob ? jobLabel(linkedJob.id) : 'None'} onPress={() => setPicker('job')} />
        </Group>

        {/* Receipt */}
        <Group>
          {receiptUri ? (
            <View className="p-4">
              <Image source={{ uri: receiptUri }} style={{ width: '100%', height: 220, borderRadius: 12 }} resizeMode="cover" />
              <Pressable onPress={() => setReceiptUri(null)} className="min-h-[44px] items-center justify-center mt-1" accessibilityRole="button">
                <Text className="text-alert text-[15px] font-semibold">Remove receipt</Text>
              </Pressable>
            </View>
          ) : (
            <>
              <LinkRow icon={Camera} label="Photograph receipt" onPress={() => pickReceipt(true)} />
              <RowDivider />
              <LinkRow icon={ImageIcon} label="Choose from photos" onPress={() => pickReceipt(false)} />
            </>
          )}
        </Group>
      </ScrollView>

      {/* Category picker */}
      <Sheet visible={picker === 'category'} onClose={() => setPicker(null)}>
        <Text className="text-fg text-[17px] font-semibold text-center mb-3">Category</Text>
        <View className="bg-bg rounded-2xl overflow-hidden">
          {CATEGORIES.map((cat, i) => (
            <View key={cat}>
              {i > 0 && <RowDivider />}
              <Pressable
                onPress={() => {
                  setCategory(cat);
                  setPicker(null);
                  Haptics.selectionAsync();
                }}
                className="flex-row items-center px-4 min-h-[48px] active:opacity-70"
                accessibilityRole="button"
                accessibilityState={{ selected: category === cat }}
              >
                <Text className="flex-1 text-fg text-base">{EXPENSE_CATEGORY_LABELS[cat]}</Text>
                {category === cat && <Check size={20} color={t.link} strokeWidth={2} />}
              </Pressable>
            </View>
          ))}
        </View>
      </Sheet>

      {/* Job picker */}
      <Sheet visible={picker === 'job'} onClose={() => setPicker(null)}>
        <Text className="text-fg text-[17px] font-semibold text-center mb-3">Link to a job</Text>
        <View className="bg-bg rounded-2xl overflow-hidden">
          {[null, ...linkableJobs.map((j) => j.id)].map((id, i) => (
            <View key={id ?? 'none'}>
              {i > 0 && <RowDivider />}
              <Pressable
                onPress={() => {
                  setJobId(id);
                  setPicker(null);
                  Haptics.selectionAsync();
                }}
                className="flex-row items-center px-4 min-h-[48px] active:opacity-70"
                accessibilityRole="button"
                accessibilityState={{ selected: jobId === id }}
              >
                <Text className="flex-1 text-fg text-base" numberOfLines={1}>
                  {id ? jobLabel(id) : 'No job — general business expense'}
                </Text>
                {jobId === id && <Check size={20} color={t.link} strokeWidth={2} />}
              </Pressable>
            </View>
          ))}
        </View>
      </Sheet>
    </View>
  );
}

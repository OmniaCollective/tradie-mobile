import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Image,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import {
  X,
  Check,
  ChevronDown,
  Camera,
  Wrench,
} from 'lucide-react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import DateTimePicker from '@react-native-community/datetimepicker';
import {
  useTradeStore,
  useJobs,
  ExpenseCategory,
  EXPENSE_CATEGORY_LABELS,
} from '@/lib/store';
import { getJobTypeLabel } from '@/lib/trades';

const TURQUOISE = '#14B8A6';

const CATEGORIES: ExpenseCategory[] = [
  'tools_equipment',
  'materials',
  'vehicle_mileage',
  'subcontractor',
  'insurance',
  'phone_internet',
  'workwear_ppe',
  'training',
  'home_office',
  'other',
];

// HMRC approved mileage rates
const MILEAGE_RATE_FIRST_10K = 0.45;
const MILEAGE_RATE_AFTER_10K = 0.25;

export default function AddExpenseScreen() {
  const router = useRouter();
  const { jobId: routeJobId } = useLocalSearchParams<{ jobId?: string }>();
  const { addExpense, expenses, getCustomer, settings } = useTradeStore();
  const jobs = useJobs();

  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<ExpenseCategory | null>(null);
  const [date, setDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  const [receiptUri, setReceiptUri] = useState<string | null>(null);
  const [miles, setMiles] = useState('');
  const [businessUsePercent, setBusinessUsePercent] = useState('100');
  const [saving, setSaving] = useState(false);
  const [vatAmount, setVatAmount] = useState('');
  const [selectedJobId, setSelectedJobId] = useState<string | null>(routeJobId || null);
  const [showJobPicker, setShowJobPicker] = useState(false);

  // Jobs that make sense to link expenses to (active or recently completed)
  const linkableJobs = jobs.filter((j) =>
    ['SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'INVOICED', 'APPROVED'].includes(j.status)
  ).sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  // Calculate mileage amount based on HMRC rates
  const calculateMileageAmount = (milesStr: string): number => {
    const totalMiles = parseFloat(milesStr) || 0;
    if (totalMiles === 0) return 0;

    // Get miles already claimed this tax year
    const now = new Date();
    const taxYearStart = (now.getMonth() > 3) || (now.getMonth() === 3 && now.getDate() >= 6)
      ? new Date(now.getFullYear(), 3, 6)
      : new Date(now.getFullYear() - 1, 3, 6);

    const taxYearMiles = expenses
      .filter((e) => e.category === 'vehicle_mileage' && e.miles && new Date(e.date) >= taxYearStart)
      .reduce((sum, e) => sum + (e.miles || 0), 0);

    const remainingAt45p = Math.max(0, 10000 - taxYearMiles);
    const milesAt45p = Math.min(totalMiles, remainingAt45p);
    const milesAt25p = Math.max(0, totalMiles - milesAt45p);

    return (milesAt45p * MILEAGE_RATE_FIRST_10K) + (milesAt25p * MILEAGE_RATE_AFTER_10K);
  };

  const mileageAmount = category === 'vehicle_mileage' ? calculateMileageAmount(miles) : 0;

  const canSave = category && (
    category === 'vehicle_mileage'
      ? parseFloat(miles) > 0
      : parseFloat(amount) > 0
  );

  const handlePickReceipt = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.7,
      allowsMultipleSelection: false,
    });

    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      const fileName = `receipt_${Date.now()}.jpg`;
      const destDir = `${FileSystem.documentDirectory}receipts/`;
      await FileSystem.makeDirectoryAsync(destDir, { intermediates: true });
      const destUri = `${destDir}${fileName}`;
      await FileSystem.copyAsync({ from: asset.uri, to: destUri });
      setReceiptUri(destUri);
    }
  };

  const handleTakePhoto = async () => {
    const { granted } = await ImagePicker.requestCameraPermissionsAsync();
    if (!granted) return;

    const result = await ImagePicker.launchCameraAsync({
      quality: 0.7,
    });

    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      const fileName = `receipt_${Date.now()}.jpg`;
      const destDir = `${FileSystem.documentDirectory}receipts/`;
      await FileSystem.makeDirectoryAsync(destDir, { intermediates: true });
      const destUri = `${destDir}${fileName}`;
      await FileSystem.copyAsync({ from: asset.uri, to: destUri });
      setReceiptUri(destUri);
    }
  };

  const handleSave = async () => {
    if (!category || !canSave) return;
    setSaving(true);

    try {
      const finalAmount = category === 'vehicle_mileage'
        ? mileageAmount
        : parseFloat(amount) || 0;

      const businessPercent = category === 'phone_internet'
        ? parseFloat(businessUsePercent) || 100
        : undefined;

      const adjustedAmount = businessPercent !== undefined
        ? finalAmount * (businessPercent / 100)
        : finalAmount;

      addExpense({
        amount: Math.round(adjustedAmount * 100) / 100,
        description: description.trim() || EXPENSE_CATEGORY_LABELS[category],
        category,
        date: date.toISOString().split('T')[0],
        receiptUri: receiptUri || undefined,
        miles: category === 'vehicle_mileage' ? parseFloat(miles) || undefined : undefined,
        businessUsePercent: businessPercent,
        vatAmount: parseFloat(vatAmount) > 0 ? Math.round(parseFloat(vatAmount) * 100) / 100 : undefined,
        jobId: selectedJobId || undefined,
      });

      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.back();
    } catch (error) {
      console.error('Save expense error:', error);
      setSaving(false);
    }
  };

  const formatDateStr = (d: Date) =>
    d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      className="flex-1 bg-[#0F172A]"
    >
      {/* Header */}
      <View className="flex-row items-center justify-between px-4 pt-4 pb-2">
        <Pressable
          onPress={() => router.back()}
          className="w-10 h-10 rounded-full bg-[#1E293B] items-center justify-center"
        >
          <X size={20} color="#F8FAFC" />
        </Pressable>
        <Text className="text-white font-bold text-lg">Add Expense</Text>
        <View className="w-10" />
      </View>

      <ScrollView className="flex-1 px-4" keyboardShouldPersistTaps="handled">
        <Animated.View entering={FadeInDown.duration(400)}>
          {/* Category */}
          <Text className="text-slate-400 text-xs uppercase tracking-wide mb-2 mt-2">Category</Text>
          <View className="bg-[#1E293B] rounded-xl border border-[#334155] p-4 mb-4">
            <Pressable
              onPress={() => setShowCategoryPicker(!showCategoryPicker)}
              className="flex-row items-center"
            >
              <Text className={`flex-1 text-base ${category ? 'text-white font-semibold' : 'text-slate-500'}`}>
                {category ? EXPENSE_CATEGORY_LABELS[category] : 'Select category'}
              </Text>
              <ChevronDown size={18} color="#64748B" />
            </Pressable>

            {showCategoryPicker && (
              <Animated.View entering={FadeInDown.duration(200)} className="mt-3 border-t border-[#334155] pt-3">
                {CATEGORIES.map((cat) => {
                  const isSelected = category === cat;
                  return (
                    <Pressable
                      key={cat}
                      onPress={() => {
                        setCategory(cat);
                        setShowCategoryPicker(false);
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      }}
                      className={`flex-row items-center rounded-lg p-3 mb-1 ${isSelected ? 'bg-[#14B8A6]/15' : ''}`}
                    >
                      <Text className="text-white flex-1">{EXPENSE_CATEGORY_LABELS[cat]}</Text>
                      {isSelected && <Check size={16} color={TURQUOISE} />}
                    </Pressable>
                  );
                })}
              </Animated.View>
            )}
          </View>

          {/* Amount — different UI for mileage vs regular */}
          {category && (
            <>
              <Text className="text-slate-400 text-xs uppercase tracking-wide mb-2">
                {category === 'vehicle_mileage' ? 'Mileage' : 'Amount'}
              </Text>
              <View className="bg-[#1E293B] rounded-xl border border-[#334155] p-4 mb-4">
                {category === 'vehicle_mileage' ? (
                  <>
                    <View className="flex-row items-center">
                      <TextInput
                        className="flex-1 text-white text-2xl font-bold"
                        placeholder="0"
                        placeholderTextColor="#475569"
                        value={miles}
                        onChangeText={setMiles}
                        keyboardType="numeric"
                      />
                      <Text className="text-slate-400 text-base ml-2">miles</Text>
                    </View>
                    {parseFloat(miles) > 0 && (
                      <View className="mt-3 border-t border-[#334155] pt-3">
                        <View className="flex-row justify-between">
                          <Text className="text-slate-500 text-sm">HMRC rate</Text>
                          <Text className="text-slate-400 text-sm">45p (first 10k) / 25p (after)</Text>
                        </View>
                        <View className="flex-row justify-between mt-2">
                          <Text className="text-white font-medium">Claimable amount</Text>
                          <Text className="text-[#14B8A6] font-bold text-lg">£{mileageAmount.toFixed(2)}</Text>
                        </View>
                      </View>
                    )}
                  </>
                ) : (
                  <>
                    <View className="flex-row items-center">
                      <Text className="text-slate-400 text-2xl mr-2">£</Text>
                      <TextInput
                        className="flex-1 text-white text-2xl font-bold"
                        placeholder="0.00"
                        placeholderTextColor="#475569"
                        value={amount}
                        onChangeText={setAmount}
                        keyboardType="decimal-pad"
                      />
                    </View>
                    {category === 'phone_internet' && (
                      <View className="mt-3 border-t border-[#334155] pt-3">
                        <View className="flex-row items-center justify-between">
                          <Text className="text-slate-400 text-sm">Business use</Text>
                          <View className="flex-row items-center bg-[#0F172A] rounded-xl px-3 py-2">
                            <TextInput
                              className="text-white text-base w-12 text-right"
                              value={businessUsePercent}
                              onChangeText={setBusinessUsePercent}
                              keyboardType="numeric"
                            />
                            <Text className="text-slate-400 ml-1">%</Text>
                          </View>
                        </View>
                        {parseFloat(amount) > 0 && (
                          <View className="flex-row justify-between mt-2">
                            <Text className="text-white font-medium">Claimable</Text>
                            <Text className="text-[#14B8A6] font-bold">
                              £{((parseFloat(amount) || 0) * (parseFloat(businessUsePercent) || 0) / 100).toFixed(2)}
                            </Text>
                          </View>
                        )}
                      </View>
                    )}
                  </>
                )}
              </View>

              {/* VAT on expense — for VAT-registered users, on categories where input VAT applies */}
              {settings.vatRegistered && category && !['vehicle_mileage', 'phone_internet'].includes(category) && (
                <>
                  <Text className="text-slate-400 text-xs uppercase tracking-wide mb-2">VAT Included</Text>
                  <View className="bg-[#1E293B] rounded-xl border border-[#334155] p-4 mb-4">
                    <View className="flex-row items-center">
                      <Text className="text-slate-400 text-base mr-2">£</Text>
                      <TextInput
                        className="flex-1 text-white text-base"
                        placeholder="0.00 (optional)"
                        placeholderTextColor="#475569"
                        value={vatAmount}
                        onChangeText={setVatAmount}
                        keyboardType="decimal-pad"
                      />
                    </View>
                    {parseFloat(amount) > 0 && !vatAmount && (
                      <Pressable
                        onPress={() => {
                          const amt = parseFloat(amount) || 0;
                          setVatAmount((amt - amt / 1.2).toFixed(2));
                        }}
                        className="mt-2 active:opacity-70"
                      >
                        <Text className="text-[#14B8A6] text-xs">Auto-calculate 20% VAT</Text>
                      </Pressable>
                    )}
                    <Text className="text-slate-600 text-[10px] mt-1">
                      Reclaimable input VAT — reduces your VAT bill
                    </Text>
                  </View>
                </>
              )}

              {/* Description */}
              <Text className="text-slate-400 text-xs uppercase tracking-wide mb-2">Description</Text>
              <View className="bg-[#1E293B] rounded-xl border border-[#334155] p-4 mb-4">
                <TextInput
                  className="text-white text-base"
                  placeholder="What was this for? (optional)"
                  placeholderTextColor="#475569"
                  value={description}
                  onChangeText={setDescription}
                  multiline
                />
              </View>

              {/* Date */}
              <Text className="text-slate-400 text-xs uppercase tracking-wide mb-2">Date</Text>
              <View className="bg-[#1E293B] rounded-xl border border-[#334155] mb-4">
                <Pressable
                  onPress={() => setShowDatePicker(!showDatePicker)}
                  className="p-4"
                >
                  <Text className="text-white text-base">{formatDateStr(date)}</Text>
                </Pressable>
                {showDatePicker && (
                  <View className="border-t border-[#334155]">
                    <DateTimePicker
                      value={date}
                      mode="date"
                      display="inline"
                      maximumDate={new Date()}
                      onChange={(_, d) => {
                        if (d) setDate(d);
                        if (Platform.OS === 'android') setShowDatePicker(false);
                      }}
                      themeVariant="dark"
                      accentColor={TURQUOISE}
                    />
                    {Platform.OS === 'ios' && (
                      <Pressable onPress={() => setShowDatePicker(false)} className="p-3 items-center border-t border-[#334155]">
                        <Text className="text-[#14B8A6] font-semibold">Done</Text>
                      </Pressable>
                    )}
                  </View>
                )}
              </View>

              {/* Link to Job */}
              <Text className="text-slate-400 text-xs uppercase tracking-wide mb-2">Link to Job</Text>
              <View className="bg-[#1E293B] rounded-xl border border-[#334155] p-4 mb-4">
                <Pressable
                  onPress={() => setShowJobPicker(!showJobPicker)}
                  className="flex-row items-center"
                >
                  {selectedJobId ? (
                    <View className="flex-row items-center flex-1">
                      <View className="w-8 h-8 rounded-lg bg-[#14B8A6]/20 items-center justify-center mr-2">
                        <Wrench size={14} color={TURQUOISE} />
                      </View>
                      <View className="flex-1">
                        <Text className="text-white font-medium text-sm">
                          {(() => {
                            const j = jobs.find((jb) => jb.id === selectedJobId);
                            return j ? getJobTypeLabel(settings.trade, j.type) : 'Unknown job';
                          })()}
                        </Text>
                        <Text className="text-slate-500 text-xs">
                          {(() => {
                            const j = jobs.find((jb) => jb.id === selectedJobId);
                            if (!j) return '';
                            const c = getCustomer(j.customerId);
                            return c?.name || '';
                          })()}
                        </Text>
                      </View>
                      <Pressable
                        onPress={() => { setSelectedJobId(null); setShowJobPicker(false); }}
                        className="p-1"
                      >
                        <X size={16} color="#64748B" />
                      </Pressable>
                    </View>
                  ) : (
                    <>
                      <Text className="flex-1 text-slate-500 text-base">None (general expense)</Text>
                      <ChevronDown size={18} color="#64748B" />
                    </>
                  )}
                </Pressable>

                {showJobPicker && linkableJobs.length > 0 && (
                  <Animated.View entering={FadeInDown.duration(200)} className="mt-3 border-t border-[#334155] pt-3">
                    {linkableJobs.slice(0, 8).map((j) => {
                      const isSelected = selectedJobId === j.id;
                      const customer = getCustomer(j.customerId);
                      return (
                        <Pressable
                          key={j.id}
                          onPress={() => {
                            setSelectedJobId(j.id);
                            setShowJobPicker(false);
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                          }}
                          className={`flex-row items-center rounded-lg p-3 mb-1 ${isSelected ? 'bg-[#14B8A6]/15' : ''}`}
                        >
                          <View className="flex-1">
                            <Text className="text-white text-sm">
                              {getJobTypeLabel(settings.trade, j.type)}
                            </Text>
                            <Text className="text-slate-500 text-xs">
                              {customer?.name || 'Unknown'}
                            </Text>
                          </View>
                          {isSelected && <Check size={16} color={TURQUOISE} />}
                        </Pressable>
                      );
                    })}
                    {linkableJobs.length === 0 && (
                      <Text className="text-slate-500 text-sm text-center py-2">No active jobs</Text>
                    )}
                  </Animated.View>
                )}
              </View>

              {/* Receipt */}
              <Text className="text-slate-400 text-xs uppercase tracking-wide mb-2">Receipt</Text>
              <View className="bg-[#1E293B] rounded-xl border border-[#334155] p-4 mb-4">
                {receiptUri ? (
                  <View>
                    <Image
                      source={{ uri: receiptUri }}
                      style={{ width: '100%', height: 200, borderRadius: 12 }}
                      resizeMode="cover"
                    />
                    <Pressable
                      onPress={() => setReceiptUri(null)}
                      className="mt-2 items-center"
                    >
                      <Text className="text-[#EF4444] text-sm">Remove</Text>
                    </Pressable>
                  </View>
                ) : (
                  <View className="flex-row gap-2">
                    <Pressable
                      onPress={handleTakePhoto}
                      className="flex-1 bg-[#0F172A] rounded-xl py-3 flex-row items-center justify-center active:opacity-80"
                    >
                      <Camera size={18} color="#64748B" />
                      <Text className="text-slate-400 text-sm ml-2">Take Photo</Text>
                    </Pressable>
                    <Pressable
                      onPress={handlePickReceipt}
                      className="flex-1 bg-[#0F172A] rounded-xl py-3 flex-row items-center justify-center active:opacity-80"
                    >
                      <Text className="text-slate-400 text-sm">Choose Photo</Text>
                    </Pressable>
                  </View>
                )}
              </View>

              {/* Save Button */}
              <Pressable
                onPress={handleSave}
                disabled={!canSave || saving}
                className={`rounded-xl p-4 flex-row items-center justify-center mb-8 ${
                  canSave && !saving ? 'bg-[#14B8A6] active:opacity-80' : 'bg-[#334155]'
                }`}
              >
                <Check size={20} color={canSave ? '#FFF' : '#64748B'} />
                <Text className={`font-bold text-base ml-2 ${canSave && !saving ? 'text-white' : 'text-slate-500'}`}>
                  {saving ? 'Saving...' : 'Save Expense'}
                </Text>
              </Pressable>
            </>
          )}
        </Animated.View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

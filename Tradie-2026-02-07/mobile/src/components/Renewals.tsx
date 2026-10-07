/**
 * Insurance, licences and registrations with expiry dates. Each gets reminders
 * 30 and 7 days before and on the day; anything due soon also shows on Home.
 */
import React, { useState } from 'react';
import { View, Text, Pressable, TextInput, Platform, ScrollView } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Plus, ShieldCheck, CircleAlert } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useTradeStore, useRenewals, useRegion, getRegion, daysUntil, type Renewal } from '@/lib/store';
import { scheduleRenewalReminders, cancelRenewalReminders } from '@/lib/notifications';
import { parseDate, toDateKey } from '@/lib/dates';
import { useTheme } from '@/lib/theme';
import { cn } from '@/lib/cn';
import { Group, RowDivider, SectionHeader, PrimaryButton, Sheet, LinkRow } from '@/components/ui';
import { ConfirmModal } from '@/components/ConfirmModal';
import { toast } from '@/components/Toast';

const SUGGESTIONS = {
  GB: ['Public liability insurance', 'Gas Safe registration', 'Van insurance', 'Part P / NICEIC', 'Waste carrier licence'],
  US: ['General liability insurance', 'Contractor license', "Workers' comp insurance", 'Vehicle insurance', 'Surety bond'],
} as const;

/** How soon, in words: "Expires in 12 days", "Expired 3 days ago". */
export function renewalStatus(r: Pick<Renewal, 'expires'>): { text: string; urgent: boolean } {
  const days = daysUntil(r.expires);
  if (days < 0) return { text: `Expired ${-days === 1 ? 'yesterday' : `${-days} days ago`}`, urgent: true };
  if (days === 0) return { text: 'Expires today', urgent: true };
  if (days <= 30) return { text: `Expires in ${days} ${days === 1 ? 'day' : 'days'}`, urgent: true };
  return {
    text: `Expires ${parseDate(r.expires).toLocaleDateString(getRegion().locale, { day: 'numeric', month: 'short', year: 'numeric' })}`,
    urgent: false,
  };
}

type Draft = { id?: string; name: string; reference: string; expires: Date };

export function RenewalsSection() {
  const renewals = useRenewals();
  const addRenewal = useTradeStore((s) => s.addRenewal);
  const updateRenewal = useTradeStore((s) => s.updateRenewal);
  const deleteRenewal = useTradeStore((s) => s.deleteRenewal);
  const { country } = useRegion();
  const t = useTheme();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [pendingDelete, setPendingDelete] = useState<{ id: string; name: string } | null>(null);

  const sorted = [...renewals].sort((a, b) => a.expires.localeCompare(b.expires));

  const openNew = () => {
    const nextYear = new Date();
    nextYear.setFullYear(nextYear.getFullYear() + 1);
    setDraft({ name: '', reference: '', expires: nextYear });
  };

  const save = async () => {
    if (!draft || !draft.name.trim()) return;
    const fields = { name: draft.name.trim(), reference: draft.reference.trim() || undefined, expires: toDateKey(draft.expires) };
    const id = draft.id ?? addRenewal(fields);
    if (draft.id) updateRenewal(draft.id, fields);
    setDraft(null);
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    toast('Saved. Reminders set');
    await scheduleRenewalReminders({ id, name: fields.name, expires: fields.expires });
  };

  return (
    <>
      <SectionHeader title="Insurance and licences" />
      <Group className="mb-2">
        {sorted.map((r, i) => {
          const status = renewalStatus(r);
          return (
            <View key={r.id}>
              {i > 0 && <RowDivider />}
              <Pressable
                onPress={() => setDraft({ id: r.id, name: r.name, reference: r.reference ?? '', expires: parseDate(r.expires) })}
                className="flex-row items-center px-4 py-3 active:opacity-70"
                accessibilityRole="button"
              >
                {status.urgent ? (
                  <CircleAlert size={20} color={t.alert} strokeWidth={2} />
                ) : (
                  <ShieldCheck size={20} color={t.secondary} strokeWidth={2} />
                )}
                <View className="flex-1 ml-3">
                  <Text className="text-fg text-base" numberOfLines={1}>
                    {r.name}
                  </Text>
                  <Text className={cn('text-sm', status.urgent ? 'text-alert' : 'text-secondary')} numberOfLines={1}>
                    {status.text}
                    {r.reference ? ` · ${r.reference}` : ''}
                  </Text>
                </View>
              </Pressable>
            </View>
          );
        })}
        {sorted.length > 0 && <RowDivider />}
        <Pressable
          onPress={openNew}
          className="flex-row items-center px-4 min-h-[52px] active:opacity-70"
          accessibilityRole="button"
        >
          <Plus size={20} color={t.link} strokeWidth={2} />
          <Text className="text-link text-base font-semibold ml-2">Add insurance or licence</Text>
        </Pressable>
      </Group>
      <Text className="text-secondary text-[13px] mx-1 mb-8">Reminders 30 days and 7 days before each one expires.</Text>

      {draft && (
        <Sheet visible onClose={() => setDraft(null)}>
          <ScrollView keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets style={{ maxHeight: 620 }}>
            <Text className="text-fg text-[20px] font-semibold mb-4">{draft.id ? 'Edit' : 'Add insurance or licence'}</Text>
            {!draft.id && (
              <View className="flex-row flex-wrap gap-2 mb-4">
                {SUGGESTIONS[country].map((s) => (
                  <Pressable
                    key={s}
                    onPress={() => setDraft({ ...draft, name: s })}
                    className={cn('px-3 h-9 rounded-full justify-center', draft.name === s ? 'bg-accent' : 'bg-bg')}
                    accessibilityRole="button"
                  >
                    <Text className={cn('text-sm font-medium', draft.name === s ? 'text-on-accent' : 'text-fg')}>{s}</Text>
                  </Pressable>
                ))}
              </View>
            )}
            <Group className="bg-bg mb-4">
              <View className="px-4 pt-3 pb-1">
                <Text className="text-secondary text-[13px]">Name</Text>
                <TextInput
                  className="text-fg text-base py-2"
                  value={draft.name}
                  onChangeText={(v) => setDraft({ ...draft, name: v })}
                  placeholder="e.g. Public liability insurance"
                  placeholderTextColor={t.secondary}
                  accessibilityLabel="Name"
                />
              </View>
              <RowDivider />
              <View className="px-4 pt-3 pb-1">
                <Text className="text-secondary text-[13px]">Policy or licence number (optional)</Text>
                <TextInput
                  className="text-fg text-base py-2"
                  value={draft.reference}
                  onChangeText={(v) => setDraft({ ...draft, reference: v })}
                  placeholder="Number"
                  placeholderTextColor={t.secondary}
                  autoCapitalize="characters"
                  accessibilityLabel="Policy or licence number"
                />
              </View>
            </Group>
            <Text className="text-fg text-base font-semibold mb-1">Expires</Text>
            <DateTimePicker
              value={draft.expires}
              mode="date"
              display={Platform.OS === 'ios' ? 'inline' : 'default'}
              onChange={(_, d) => d && setDraft({ ...draft, expires: d })}
              themeVariant={t.mode}
              accentColor={t.link}
            />
            <PrimaryButton label="Save" onPress={save} disabled={!draft.name.trim()} className="mt-2" />
            {draft.id ? (
              <View className="mt-2">
                <LinkRow
                  label="Delete"
                  destructive
                  onPress={() => {
                    setPendingDelete({ id: draft.id!, name: draft.name });
                    setDraft(null);
                  }}
                />
              </View>
            ) : (
              <Pressable
                onPress={() => setDraft(null)}
                className="min-h-[48px] items-center justify-center mt-1"
                accessibilityRole="button"
              >
                <Text className="text-secondary text-base font-semibold">Cancel</Text>
              </Pressable>
            )}
          </ScrollView>
        </Sheet>
      )}

      <ConfirmModal
        visible={!!pendingDelete}
        title={`Delete ${pendingDelete?.name || 'this'}?`}
        message="Its reminders will stop too."
        confirmText="Delete"
        cancelText="Cancel"
        variant="error"
        onConfirm={async () => {
          if (!pendingDelete) return;
          await cancelRenewalReminders(pendingDelete.id);
          deleteRenewal(pendingDelete.id);
          toast('Deleted');
        }}
        onCancel={() => {}}
        onDismiss={() => setPendingDelete(null)}
      />
    </>
  );
}

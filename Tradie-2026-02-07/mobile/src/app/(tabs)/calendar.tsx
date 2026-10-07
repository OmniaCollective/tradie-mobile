import React, { useState, useMemo } from 'react';
import { View, Text, ScrollView, Pressable, TextInput } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeft, ChevronRight, Plus, Circle, CircleCheck, Trash2, Mic, CalendarClock } from 'lucide-react-native';
import { useTradeStore, useJobs, useTodos, useSettings, type Job, getRegion, OfferedSlot } from '@/lib/store';
import { getJobTypeLabel } from '@/lib/store';
import { formatTime, toDateKey, parseDate } from '@/lib/dates';
import { useTheme } from '@/lib/theme';
import { cn } from '@/lib/cn';
import { Group, RowDivider, SectionHeader, PrimaryButton } from '@/components/ui';
import { JobStatus } from '@/components/JobStatus';
import { activeOffer, formatSlot, slotDate } from '@/lib/booking';

// UK weeks start on Monday.
const WEEKDAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];
const TODOS_SHOWN = 5;

export default function JobsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const t = useTheme();
  const jobs = useJobs();
  const todos = useTodos();
  const settings = useSettings();
  const getCustomer = useTradeStore((s) => s.getCustomer);
  const updateJob = useTradeStore((s) => s.updateJob);
  const addTodo = useTradeStore((s) => s.addTodo);
  const toggleTodo = useTradeStore((s) => s.toggleTodo);
  const deleteTodo = useTradeStore((s) => s.deleteTodo);

  const [todayKey] = useState(() => toDateKey());
  const [month, setMonth] = useState(() => new Date().getMonth());
  const [year, setYear] = useState(() => new Date().getFullYear());
  const [selected, setSelected] = useState(todayKey);
  const [newTodo, setNewTodo] = useState('');
  const [showAllTodos, setShowAllTodos] = useState(false);

  const days = useMemo(() => {
    const first = new Date(year, month, 1);
    const lead = (first.getDay() + 6) % 7; // Monday = 0
    return Array.from({ length: 42 }, (_, i) => {
      const date = new Date(year, month, 1 - lead + i);
      return {
        key: toDateKey(date),
        day: date.getDate(),
        inMonth: date.getMonth() === month,
      };
    });
  }, [month, year]);

  const jobsByDate = useMemo(() => {
    const map: Record<string, Job[]> = {};
    for (const job of jobs) {
      if (job.scheduledDate) (map[job.scheduledDate] ??= []).push(job);
    }
    return map;
  }, [jobs]);

  // Times offered to customers stay pencilled in until they reply.
  const offersByDate = useMemo(() => {
    const map: Record<string, { job: Job; slot: OfferedSlot }[]> = {};
    for (const job of jobs) {
      for (const slot of activeOffer(job)) (map[slot.date] ??= []).push({ job, slot });
    }
    return map;
  }, [jobs]);

  const dayOffers = useMemo(
    () => [...(offersByDate[selected] ?? [])].sort((a, b) => a.slot.time.localeCompare(b.slot.time)),
    [offersByDate, selected],
  );

  const dayJobs = useMemo(
    () => [...(jobsByDate[selected] ?? [])].sort((a, b) => (a.scheduledTime || '').localeCompare(b.scheduledTime || '')),
    [jobsByDate, selected],
  );

  const shiftMonth = (delta: number) => {
    const d = new Date(year, month + delta, 1);
    setMonth(d.getMonth());
    setYear(d.getFullYear());
  };

  const submitTodo = () => {
    const text = newTodo.trim();
    if (!text) return;
    addTodo(text);
    setNewTodo('');
  };

  const selectedLabel =
    selected === todayKey
      ? 'Today'
      : parseDate(selected).toLocaleDateString(getRegion().locale, {
          weekday: 'long',
          day: 'numeric',
          month: 'long',
        });
  const visibleTodos = showAllTodos ? todos : todos.slice(0, TODOS_SHOWN);
  const unbooked = useMemo(
    () =>
      jobs
        .filter((j) => !j.scheduledDate && (j.status === 'REQUESTED' || j.status === 'QUOTED' || j.status === 'APPROVED'))
        .sort((x, y) => y.createdAt.localeCompare(x.createdAt)),
    [jobs],
  );

  return (
    <ScrollView
      className="flex-1 bg-bg"
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={{
        paddingTop: insets.top + 16,
        paddingBottom: 32,
        paddingHorizontal: 16,
      }}
    >
      {/* Header */}
      <View className="flex-row items-center justify-between mb-5">
        <Text className="text-fg text-[28px] font-bold tracking-tight">Jobs</Text>
        <PrimaryButton compact icon={Plus} label="New job" onPress={() => router.push(`/add-job?date=${selected}`)} />
      </View>

      {/* Calendar */}
      <Group className="px-2 pb-2 mb-8">
        <View className="flex-row items-center justify-between px-1">
          <Pressable
            onPress={() => shiftMonth(-1)}
            className="w-11 h-11 items-center justify-center active:opacity-60"
            accessibilityRole="button"
            accessibilityLabel="Previous month"
          >
            <ChevronLeft size={20} color={t.fg} strokeWidth={2} />
          </Pressable>
          <Text className="text-fg text-[17px] font-semibold">
            {MONTHS[month]} {year}
          </Text>
          <Pressable
            onPress={() => shiftMonth(1)}
            className="w-11 h-11 items-center justify-center active:opacity-60"
            accessibilityRole="button"
            accessibilityLabel="Next month"
          >
            <ChevronRight size={20} color={t.fg} strokeWidth={2} />
          </Pressable>
        </View>

        <View className="flex-row">
          {WEEKDAYS.map((d, i) => (
            <Text key={i} className="flex-1 text-center text-secondary text-xs font-medium py-1.5">
              {d}
            </Text>
          ))}
        </View>

        <View className="flex-row flex-wrap">
          {days.map((d) => {
            const isSelected = d.key === selected;
            const isToday = d.key === todayKey;
            const hasJobs = (jobsByDate[d.key]?.length ?? 0) > 0;
            const hasOffers = !hasJobs && (offersByDate[d.key]?.length ?? 0) > 0;
            return (
              <Pressable
                key={d.key}
                onPress={() => setSelected(d.key)}
                className="w-[14.2857%] h-11 items-center justify-center"
                accessibilityRole="button"
                accessibilityLabel={`${d.day}${hasJobs ? ', has jobs' : hasOffers ? ', times pencilled in' : ''}`}
                accessibilityState={{ selected: isSelected }}
              >
                <View className={cn('w-9 h-9 rounded-full items-center justify-center', isSelected && 'bg-accent')}>
                  <Text
                    className={cn(
                      'text-[15px]',
                      isSelected
                        ? 'text-on-accent font-semibold'
                        : isToday
                          ? 'text-link font-bold'
                          : d.inMonth
                            ? 'text-fg'
                            : 'text-secondary opacity-50',
                    )}
                  >
                    {d.day}
                  </Text>
                </View>
                {hasJobs && !isSelected && <View className="absolute bottom-0.5 w-1 h-1 rounded-full bg-secondary" />}
                {hasOffers && !isSelected && (
                  <View className="absolute bottom-0.5 w-1.5 h-1.5 rounded-full border border-secondary" />
                )}
              </Pressable>
            );
          })}
        </View>
      </Group>

      {/* Selected day */}
      <View className="mb-8">
        <SectionHeader title={selectedLabel} />
        {dayJobs.length === 0 && dayOffers.length === 0 ? (
          <Group className="p-4">
            <Text className="text-secondary text-[15px]">No jobs this day.</Text>
          </Group>
        ) : (
          <Group>
            {dayJobs.map((job, i) => {
              const customer = getCustomer(job.customerId);
              return (
                <View key={job.id}>
                  {i > 0 && <RowDivider />}
                  <View className="flex-row items-center pr-4">
                    <Pressable
                      onPress={() => router.push(`/job/${job.id}`)}
                      className="flex-1 flex-row items-center pl-4 py-3 active:opacity-70"
                      accessibilityRole="button"
                    >
                      <Text className="text-fg text-sm font-semibold w-[72px]">{formatTime(job.scheduledTime)}</Text>
                      <View className="flex-1 mr-2">
                        <Text className="text-fg text-base font-medium" numberOfLines={1}>
                          {getJobTypeLabel(settings.trade, job.type)}
                        </Text>
                        <Text className="text-secondary text-sm" numberOfLines={1}>
                          {customer?.name ?? 'Unknown customer'}
                        </Text>
                        <View className="mt-1">
                          <JobStatus job={job} />
                        </View>
                      </View>
                    </Pressable>
                    {job.status === 'SCHEDULED' ? (
                      <Pressable
                        onPress={() => updateJob(job.id, { status: 'IN_PROGRESS' })}
                        hitSlop={8}
                        className="min-h-[44px] justify-center pl-2"
                        accessibilityRole="button"
                        accessibilityLabel="Start job"
                      >
                        <Text className="text-link text-[15px] font-semibold">Start</Text>
                      </Pressable>
                    ) : (
                      <ChevronRight size={16} color={t.secondary} strokeWidth={2} />
                    )}
                  </View>
                </View>
              );
            })}
            {dayOffers.map(({ job, slot }, i) => {
              const customer = getCustomer(job.customerId);
              return (
                <View key={`${job.id}-${slot.time}`}>
                  {(i > 0 || dayJobs.length > 0) && <RowDivider />}
                  <Pressable
                    onPress={() => router.push(`/job/${job.id}`)}
                    className="flex-row items-center px-4 py-3 active:opacity-70"
                    accessibilityRole="button"
                    accessibilityLabel={`Pencilled in: ${formatSlot(slotDate(slot))}, ${customer?.name ?? ''}`}
                  >
                    <Text className="text-secondary text-sm font-semibold w-[72px]">{formatTime(slot.time)}</Text>
                    <View className="flex-1 mr-2">
                      <Text className="text-secondary text-base" numberOfLines={1}>
                        {getJobTypeLabel(settings.trade, job.type)}
                      </Text>
                      <Text className="text-secondary text-sm" numberOfLines={1}>
                        {customer?.name ?? 'Unknown customer'}
                      </Text>
                      <View className="flex-row items-center mt-1">
                        <CalendarClock size={14} color={t.secondary} strokeWidth={2} />
                        <Text className="text-secondary text-[13px] font-medium ml-1">Pencilled in · waiting for reply</Text>
                      </View>
                    </View>
                    <ChevronRight size={16} color={t.secondary} strokeWidth={2} />
                  </Pressable>
                </View>
              );
            })}
          </Group>
        )}
      </View>

      {/* Jobs without a time yet, so nothing waiting to be booked is ever out of sight */}
      {unbooked.length > 0 && (
        <View className="mb-8">
          <SectionHeader title="Not booked yet" />
          <Group>
            {unbooked.map((job, i) => (
              <View key={job.id}>
                {i > 0 && <RowDivider />}
                <Pressable
                  onPress={() => router.push(`/job/${job.id}`)}
                  className="flex-row items-center px-4 py-3 active:opacity-70"
                  accessibilityRole="button"
                >
                  <View className="flex-1 mr-2">
                    <Text className="text-fg text-base font-medium" numberOfLines={1}>
                      {getJobTypeLabel(settings.trade, job.type)}
                    </Text>
                    <Text className="text-secondary text-sm" numberOfLines={1}>
                      {getCustomer(job.customerId)?.name ?? 'Unknown customer'}
                    </Text>
                    <View className="mt-1">
                      <JobStatus job={job} />
                    </View>
                  </View>
                  <ChevronRight size={16} color={t.secondary} strokeWidth={2} />
                </Pressable>
              </View>
            ))}
          </Group>
        </View>
      )}

      {/* To-do */}
      <View>
        <SectionHeader title="To-do" />
        <Group>
          <View className="flex-row items-center px-4 py-2">
            <TextInput
              className="flex-1 text-fg text-base py-2.5"
              placeholder="Add a reminder"
              placeholderTextColor={t.secondary}
              value={newTodo}
              onChangeText={setNewTodo}
              onSubmitEditing={submitTodo}
              returnKeyType="done"
              submitBehavior="submit"
              accessibilityLabel="New to-do"
            />
            <Pressable
              onPress={submitTodo}
              disabled={!newTodo.trim()}
              className={cn('w-11 h-11 items-center justify-center', !newTodo.trim() && 'opacity-40')}
              accessibilityRole="button"
              accessibilityLabel="Add to-do"
            >
              <Plus size={20} color={t.link} strokeWidth={2} />
            </Pressable>
          </View>
          {visibleTodos.map((todo) => (
            <View key={todo.id}>
              <RowDivider />
              <View className="flex-row items-center pl-2 pr-1">
                <Pressable
                  onPress={() => toggleTodo(todo.id)}
                  className="w-11 h-11 items-center justify-center"
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: todo.completed }}
                >
                  {todo.completed ? (
                    <CircleCheck size={20} color={t.link} strokeWidth={2} />
                  ) : (
                    <Circle size={20} color={t.secondary} strokeWidth={2} />
                  )}
                </Pressable>
                <Text className={cn('flex-1 text-base', todo.completed ? 'text-secondary line-through' : 'text-fg')}>
                  {todo.text}
                </Text>
                {todo.isVoiceNote && <Mic size={16} color={t.secondary} strokeWidth={2} />}
                <Pressable
                  onPress={() => deleteTodo(todo.id)}
                  className="w-11 h-11 items-center justify-center active:opacity-60"
                  accessibilityRole="button"
                  accessibilityLabel="Delete to-do"
                >
                  <Trash2 size={16} color={t.secondary} strokeWidth={2} />
                </Pressable>
              </View>
            </View>
          ))}
          {todos.length > TODOS_SHOWN && (
            <>
              <RowDivider />
              <Pressable onPress={() => setShowAllTodos((v) => !v)} className="px-4 py-3" accessibilityRole="button">
                <Text className="text-link text-[15px]">
                  {showAllTodos ? 'Show less' : `Show ${todos.length - TODOS_SHOWN} more`}
                </Text>
              </Pressable>
            </>
          )}
        </Group>
        <Text className="text-secondary text-[13px] mx-1 mt-2">Tip: tap the microphone key on the keyboard to speak a reminder.</Text>
      </View>
    </ScrollView>
  );
}

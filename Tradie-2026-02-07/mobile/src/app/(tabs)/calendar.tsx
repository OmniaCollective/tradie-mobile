/**
 * Diary (US: Schedule) answers "where am I, and when?": a week strip that opens to the month,
 * the chosen day's jobs in time order with offered times pencilled in, and the to-do list.
 * No statuses or money here; Home and Money hold those.
 */
import React, { useState, useMemo } from 'react';
import { View, Text, ScrollView, Pressable, TextInput } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeft, ChevronRight, ChevronDown, Plus, Circle, CircleCheck, Trash2, Mic } from 'lucide-react-native';
import {
  useTradeStore,
  useJobs,
  useTodos,
  useCustomers,
  useSettings,
  type Job,
  getRegion,
  type OfferedSlot,
  jobName,
} from '@/lib/store';
import { formatTime, toDateKey, parseDate } from '@/lib/dates';
import { useTheme } from '@/lib/theme';
import { cn } from '@/lib/cn';
import { Group, RowDivider, SectionHeader } from '@/components/ui';
import { activeOffer } from '@/lib/booking';

// Weeks start on Monday.
const WEEKDAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const TODOS_SHOWN = 5;

const mondayOf = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate() - ((d.getDay() + 6) % 7));
const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);

export default function DiaryScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const t = useTheme();
  const jobs = useJobs();
  const customers = useCustomers();
  const todos = useTodos();
  const settings = useSettings();
  const addTodo = useTradeStore((s) => s.addTodo);
  const toggleTodo = useTradeStore((s) => s.toggleTodo);
  const deleteTodo = useTradeStore((s) => s.deleteTodo);
  const isUS = getRegion().country === 'US';

  const [todayKey] = useState(() => toDateKey());
  const [selected, setSelected] = useState(todayKey);
  const [weekStart, setWeekStart] = useState(() => mondayOf(new Date()));
  const [monthOpen, setMonthOpen] = useState(false);
  const [newTodo, setNewTodo] = useState('');
  const [showAllTodos, setShowAllTodos] = useState(false);

  // Booked jobs (not ones that didn't go ahead) and times offered, by day.
  const jobsByDate = useMemo(() => {
    const map: Record<string, Job[]> = {};
    for (const job of jobs) if (job.scheduledDate && !job.lostAt) (map[job.scheduledDate] ??= []).push(job);
    return map;
  }, [jobs]);
  const offersByDate = useMemo(() => {
    const map: Record<string, { job: Job; slot: OfferedSlot }[]> = {};
    for (const job of jobs) if (!job.lostAt) for (const slot of activeOffer(job)) (map[slot.date] ??= []).push({ job, slot });
    return map;
  }, [jobs]);
  const customerName = useMemo(() => new Map(customers.map((c) => [c.id, c])), [customers]);

  const selectedDate = parseDate(selected);
  const shownMonth = monthOpen ? selectedDate : addDays(weekStart, 3); // the month most of the week is in
  const monthLabel = shownMonth.toLocaleDateString(getRegion().locale, { month: 'long', year: 'numeric' });

  const select = (d: Date) => {
    setSelected(toDateKey(d));
    setWeekStart(mondayOf(d));
  };

  const week = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const monthStart = mondayOf(new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1));
  const monthDays = Array.from({ length: 42 }, (_, i) => addDays(monthStart, i));

  const dayItems = useMemo(() => {
    const booked = (jobsByDate[selected] ?? []).map((job) => ({ job, time: job.scheduledTime || '', offered: false }));
    const offered = (offersByDate[selected] ?? []).map(({ job, slot }) => ({ job, time: slot.time, offered: true }));
    return [...booked, ...offered].sort((a, b) => a.time.localeCompare(b.time));
  }, [jobsByDate, offersByDate, selected]);

  const submitTodo = () => {
    const text = newTodo.trim();
    if (!text) return;
    addTodo(text);
    setNewTodo('');
  };

  const dayTitle =
    (selected === todayKey ? 'Today · ' : '') +
    selectedDate.toLocaleDateString(getRegion().locale, { weekday: 'long', day: 'numeric', month: 'long' });
  const visibleTodos = showAllTodos ? todos : todos.slice(0, TODOS_SHOWN);

  /** A day button for the week strip and the month grid. */
  const Day = ({ d, big, faded }: { d: Date; big?: boolean; faded?: boolean }) => {
    const key = toDateKey(d);
    const isSel = key === selected;
    const isToday = key === todayKey;
    const hasJob = !!jobsByDate[key]?.length;
    const hasOffer = !!offersByDate[key]?.length;
    const size = big ? 36 : 32;
    return (
      <Pressable
        onPress={() => {
          select(d);
          if (monthOpen) setMonthOpen(false);
        }}
        className="flex-1 items-center py-1 min-h-[44px]"
        accessibilityRole="button"
        accessibilityState={{ selected: isSel }}
        accessibilityLabel={`${d.toLocaleDateString(getRegion().locale, { weekday: 'long', day: 'numeric', month: 'long' })}${hasJob ? ', jobs booked' : ''}${hasOffer ? ', times offered' : ''}`}
      >
        <View
          style={{
            width: size,
            height: size,
            borderRadius: size / 2,
            borderWidth: isToday && !isSel ? 1.5 : 0,
            borderColor: t.link,
          }}
          className={cn('items-center justify-center', isSel && 'bg-accent')}
        >
          <Text
            className={cn(
              big ? 'text-base font-semibold' : 'text-[15px]',
              isSel ? 'text-on-accent' : faded ? 'text-secondary opacity-50' : 'text-fg',
            )}
          >
            {d.getDate()}
          </Text>
        </View>
        {/* Solid dot: booked. Ring: times offered, waiting for a reply. */}
        <View className="flex-row gap-[3px] h-1.5 mt-1">
          {hasJob && <View className="w-1.5 h-1.5 rounded-full bg-accent" />}
          {hasOffer && <View className="w-1.5 h-1.5 rounded-full border border-link" />}
        </View>
      </Pressable>
    );
  };

  return (
    <ScrollView
      className="flex-1 bg-bg"
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={{ paddingTop: insets.top + 16, paddingBottom: 32, paddingHorizontal: 16 }}
    >
      <View className="flex-row items-center justify-between mb-4">
        <Text className="text-fg text-[28px] font-bold tracking-tight" accessibilityRole="header">
          {isUS ? 'Schedule' : 'Diary'}
        </Text>
        <Pressable
          onPress={() => setMonthOpen((v) => !v)}
          className="flex-row items-center min-h-[44px] px-1"
          accessibilityRole="button"
          accessibilityState={{ expanded: monthOpen }}
          accessibilityLabel={`${monthLabel}. ${monthOpen ? 'Show the week' : 'Show the month'}`}
        >
          <Text className="text-link text-[15px] font-semibold mr-1">{monthLabel}</Text>
          <ChevronDown
            size={16}
            color={t.link}
            strokeWidth={2}
            style={{ transform: [{ rotate: monthOpen ? '180deg' : '0deg' }] }}
          />
        </Pressable>
      </View>

      {monthOpen ? (
        <Group className="px-2 py-3 mb-6">
          <View className="flex-row items-center justify-between px-1 mb-1">
            <Pressable
              onPress={() => select(new Date(selectedDate.getFullYear(), selectedDate.getMonth() - 1, 1))}
              className="w-11 h-11 items-center justify-center"
              accessibilityRole="button"
              accessibilityLabel="Previous month"
            >
              <ChevronLeft size={20} color={t.secondary} strokeWidth={2} />
            </Pressable>
            <View className="flex-1 flex-row">
              {WEEKDAYS.map((d, i) => (
                <Text key={i} className="flex-1 text-center text-secondary text-xs font-semibold">
                  {d}
                </Text>
              ))}
            </View>
            <Pressable
              onPress={() => select(new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1, 1))}
              className="w-11 h-11 items-center justify-center"
              accessibilityRole="button"
              accessibilityLabel="Next month"
            >
              <ChevronRight size={20} color={t.secondary} strokeWidth={2} />
            </Pressable>
          </View>
          {Array.from({ length: 6 }, (_, row) => (
            <View key={row} className="flex-row px-11">
              {monthDays.slice(row * 7, row * 7 + 7).map((d) => (
                <Day key={toDateKey(d)} d={d} faded={d.getMonth() !== selectedDate.getMonth()} />
              ))}
            </View>
          ))}
        </Group>
      ) : (
        <Group className="flex-row items-center px-1 py-2 mb-6">
          <Pressable
            onPress={() => setWeekStart(addDays(weekStart, -7))}
            className="w-9 h-11 items-center justify-center"
            accessibilityRole="button"
            accessibilityLabel="Previous week"
          >
            <ChevronLeft size={20} color={t.secondary} strokeWidth={2} />
          </Pressable>
          <View className="flex-1">
            <View className="flex-row">
              {week.map((d, i) => (
                <Text key={i} className="flex-1 text-center text-secondary text-xs">
                  {d.toLocaleDateString(getRegion().locale, { weekday: 'short' })}
                </Text>
              ))}
            </View>
            <View className="flex-row">
              {week.map((d) => (
                <Day key={toDateKey(d)} d={d} big />
              ))}
            </View>
          </View>
          <Pressable
            onPress={() => setWeekStart(addDays(weekStart, 7))}
            className="w-9 h-11 items-center justify-center"
            accessibilityRole="button"
            accessibilityLabel="Next week"
          >
            <ChevronRight size={20} color={t.secondary} strokeWidth={2} />
          </Pressable>
        </Group>
      )}

      {/* The chosen day */}
      <SectionHeader title={dayTitle} />
      <Group className="mb-2">
        {dayItems.map(({ job, time, offered }, i) => {
          const c = customerName.get(job.customerId);
          return (
            <View key={`${job.id}-${time}-${offered}`}>
              {i > 0 && <RowDivider />}
              <Pressable
                onPress={() => router.push(`/job/${job.id}`)}
                className="flex-row items-start px-4 py-3 min-h-[60px] active:opacity-70"
                accessibilityRole="button"
                accessibilityLabel={`${formatTime(time)}, ${jobName(job, settings.trade)}, ${c?.name ?? ''}${offered ? ', offered, waiting for a reply' : ''}`}
              >
                <Text className={cn('w-[62px] text-base font-semibold', offered ? 'text-secondary' : 'text-fg')}>
                  {formatTime(time)}
                </Text>
                <View
                  className={cn('flex-1 pl-3 border-l-[3px]', offered ? 'border-divider' : 'border-accent')}
                  style={offered ? { borderStyle: 'dashed' } : undefined}
                >
                  <Text className={cn('text-base font-medium', offered ? 'text-secondary' : 'text-fg')} numberOfLines={1}>
                    {jobName(job, settings.trade)}
                  </Text>
                  <Text className="text-secondary text-sm" numberOfLines={1}>
                    {offered
                      ? `Offered to ${c?.name.split(' ')[0] ?? 'the customer'} · waiting for a reply`
                      : [c?.name, c?.postcode].filter(Boolean).join(' · ')}
                  </Text>
                </View>
                <ChevronRight size={16} color={t.secondary} strokeWidth={2} style={{ marginTop: 4 }} />
              </Pressable>
            </View>
          );
        })}
        {dayItems.length === 0 && (
          <View className="px-4 py-4">
            <Text className="text-secondary text-[15px] mb-1">Nothing booked. Free all day.</Text>
            {selected >= todayKey && (
              <Pressable
                onPress={() => router.push(`/add-job?date=${selected}`)}
                className="flex-row items-center min-h-[44px] self-start"
                accessibilityRole="button"
              >
                <Plus size={18} color={t.link} strokeWidth={2} />
                <Text className="text-link text-[15px] font-semibold ml-1.5">Add a job on this day</Text>
              </Pressable>
            )}
          </View>
        )}
      </Group>
      {Object.keys(offersByDate).length > 0 && (
        <Text className="text-secondary text-[13px] mx-1 mb-6">Faint entries are times you’ve offered, held for 48 hours.</Text>
      )}
      <View className="h-6" />

      {/* To-do */}
      <SectionHeader title="To-do" />
      <Group>
        <View className="flex-row items-center px-4 py-2">
          <TextInput
            className="flex-1 text-fg text-base py-2.5"
            placeholder="Add a to-do"
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
                accessibilityLabel={todo.text}
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
                accessibilityLabel={`Delete ${todo.text}`}
              >
                <Trash2 size={16} color={t.secondary} strokeWidth={2} />
              </Pressable>
            </View>
          </View>
        ))}
        {todos.length > TODOS_SHOWN && (
          <>
            <RowDivider />
            <Pressable onPress={() => setShowAllTodos((v) => !v)} className="px-4 py-3 min-h-[44px]" accessibilityRole="button">
              <Text className="text-link text-[15px]">
                {showAllTodos ? 'Show less' : `Show ${todos.length - TODOS_SHOWN} more`}
              </Text>
            </Pressable>
          </>
        )}
      </Group>
      <Text className="text-secondary text-[13px] mx-1 mt-2">Tip: tap the microphone key on the keyboard to speak it.</Text>
    </ScrollView>
  );
}

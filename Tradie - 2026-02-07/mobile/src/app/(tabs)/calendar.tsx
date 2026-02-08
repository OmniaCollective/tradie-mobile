import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
} from 'react-native';
import { useRouter } from 'expo-router';
import {
  ChevronLeft,
  ChevronRight,
  Clock,
  MapPin,
  Wrench,
  Play,
} from 'lucide-react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useTradeStore, useJobs, Job } from '@/lib/store';
import { getJobTypeLabel } from '@/lib/trades';

const TURQUOISE = '#14B8A6';
const DARK_BG = '#0F172A';
const CARD_BG = '#1E293B';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

export default function CalendarScreen() {
  const router = useRouter();
  const jobs = useJobs();
  const { getCustomer, updateJob, settings } = useTradeStore();

  const today = new Date();
  const [currentMonth, setCurrentMonth] = useState(today.getMonth());
  const [currentYear, setCurrentYear] = useState(today.getFullYear());
  const [selectedDate, setSelectedDate] = useState<string>(
    today.toISOString().split('T')[0]
  );

  // Get calendar days for current month
  const calendarDays = useMemo(() => {
    const firstDay = new Date(currentYear, currentMonth, 1);
    const lastDay = new Date(currentYear, currentMonth + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDay = firstDay.getDay();

    const days: Array<{ date: string; day: number; isCurrentMonth: boolean }> = [];

    // Previous month days
    const prevMonthLastDay = new Date(currentYear, currentMonth, 0).getDate();
    for (let i = startingDay - 1; i >= 0; i--) {
      const day = prevMonthLastDay - i;
      const date = new Date(currentYear, currentMonth - 1, day);
      days.push({
        date: date.toISOString().split('T')[0],
        day,
        isCurrentMonth: false,
      });
    }

    // Current month days
    for (let i = 1; i <= daysInMonth; i++) {
      const date = new Date(currentYear, currentMonth, i);
      days.push({
        date: date.toISOString().split('T')[0],
        day: i,
        isCurrentMonth: true,
      });
    }

    // Next month days to fill the grid
    const remainingDays = 42 - days.length;
    for (let i = 1; i <= remainingDays; i++) {
      const date = new Date(currentYear, currentMonth + 1, i);
      days.push({
        date: date.toISOString().split('T')[0],
        day: i,
        isCurrentMonth: false,
      });
    }

    return days;
  }, [currentMonth, currentYear]);

  // Get jobs count by date
  const jobsByDate = useMemo(() => {
    const map: Record<string, Job[]> = {};
    jobs.forEach((job) => {
      if (job.scheduledDate && (job.status === 'SCHEDULED' || job.status === 'IN_PROGRESS')) {
        if (!map[job.scheduledDate]) {
          map[job.scheduledDate] = [];
        }
        map[job.scheduledDate].push(job);
      }
    });
    return map;
  }, [jobs]);

  // Get jobs for selected date
  const selectedDateJobs = useMemo(() => {
    return (jobsByDate[selectedDate] || []).sort((a, b) => {
      const timeA = a.scheduledTime || '00:00';
      const timeB = b.scheduledTime || '00:00';
      return timeA.localeCompare(timeB);
    });
  }, [jobsByDate, selectedDate]);

  const goToPrevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear(currentYear - 1);
    } else {
      setCurrentMonth(currentMonth - 1);
    }
  };

  const goToNextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear(currentYear + 1);
    } else {
      setCurrentMonth(currentMonth + 1);
    }
  };

  const formatTime = (time?: string) => {
    if (!time) return '';
    const [hours, minutes] = time.split(':');
    const h = parseInt(hours, 10);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const hour12 = h % 12 || 12;
    return `${hour12}:${minutes} ${ampm}`;
  };

  const isToday = (dateStr: string) => {
    return dateStr === today.toISOString().split('T')[0];
  };

  const handleStartJob = (jobId: string) => {
    updateJob(jobId, { status: 'IN_PROGRESS' });
  };

  return (
    <ScrollView className="flex-1 bg-[#0F172A]">
      <View className="px-4 pb-8">
        {/* Month Navigation */}
        <Animated.View
          entering={FadeInDown.delay(100).duration(400)}
          className="flex-row items-center justify-between mb-4"
        >
          <Pressable
            onPress={goToPrevMonth}
            className="w-10 h-10 rounded-full bg-[#1E293B] items-center justify-center active:opacity-70"
          >
            <ChevronLeft size={20} color="#F8FAFC" />
          </Pressable>
          <Text className="text-white font-bold text-lg">
            {MONTHS[currentMonth]} {currentYear}
          </Text>
          <Pressable
            onPress={goToNextMonth}
            className="w-10 h-10 rounded-full bg-[#1E293B] items-center justify-center active:opacity-70"
          >
            <ChevronRight size={20} color="#F8FAFC" />
          </Pressable>
        </Animated.View>

        {/* Calendar Grid */}
        <Animated.View
          entering={FadeInDown.delay(200).duration(400)}
          className="bg-[#1E293B] rounded-2xl border border-[#334155] p-3 mb-6"
        >
          {/* Day Headers */}
          <View className="flex-row mb-2">
            {DAYS.map((day) => (
              <View key={day} className="flex-1 items-center py-2">
                <Text className="text-slate-500 text-xs font-medium">{day}</Text>
              </View>
            ))}
          </View>

          {/* Calendar Days */}
          <View className="flex-row flex-wrap">
            {calendarDays.map((item, index) => {
              const hasJobs = jobsByDate[item.date]?.length > 0;
              const isSelected = item.date === selectedDate;
              const isTodayDate = isToday(item.date);

              return (
                <Pressable
                  key={index}
                  onPress={() => setSelectedDate(item.date)}
                  className="w-[14.28%] aspect-square items-center justify-center"
                >
                  <View
                    className={`w-10 h-10 rounded-full items-center justify-center ${
                      isSelected
                        ? 'bg-[#14B8A6]'
                        : isTodayDate
                        ? 'bg-[#334155]'
                        : ''
                    }`}
                  >
                    <Text
                      className={`text-sm font-medium ${
                        isSelected
                          ? 'text-white'
                          : item.isCurrentMonth
                          ? 'text-white'
                          : 'text-slate-600'
                      }`}
                    >
                      {item.day}
                    </Text>
                    {hasJobs && !isSelected && (
                      <View className="absolute bottom-1 w-1.5 h-1.5 rounded-full bg-[#14B8A6]" />
                    )}
                  </View>
                </Pressable>
              );
            })}
          </View>
        </Animated.View>

        {/* Selected Date Jobs */}
        <Animated.View entering={FadeInDown.delay(300).duration(400)}>
          <Text className="text-slate-400 text-sm font-semibold mb-3 uppercase tracking-wide">
            {isToday(selectedDate)
              ? 'Today'
              : new Date(selectedDate).toLocaleDateString('en-GB', {
                  weekday: 'long',
                  day: 'numeric',
                  month: 'long',
                })}
          </Text>

          {selectedDateJobs.length === 0 ? (
            <View className="bg-[#1E293B] rounded-2xl border border-[#334155] p-6 items-center">
              <Text className="text-slate-500">No jobs scheduled</Text>
            </View>
          ) : (
            <View className="gap-3">
              {selectedDateJobs.map((job) => {
                const customer = getCustomer(job.customerId);
                const isInProgress = job.status === 'IN_PROGRESS';

                return (
                  <Pressable
                    key={job.id}
                    onPress={() => router.push(`/job/${job.id}`)}
                    className="bg-[#1E293B] rounded-2xl border border-[#334155] overflow-hidden active:opacity-80"
                  >
                    {isInProgress && (
                      <View className="bg-[#14B8A6]/20 px-4 py-2 border-b border-[#334155]">
                        <View className="flex-row items-center">
                          <View className="w-2 h-2 rounded-full bg-[#14B8A6] mr-2" />
                          <Text className="text-[#14B8A6] font-semibold text-sm">In Progress</Text>
                        </View>
                      </View>
                    )}
                    <View className="p-4">
                      <View className="flex-row items-start">
                        <View className="w-12 h-12 rounded-xl bg-[#0F172A] items-center justify-center mr-3">
                          <Wrench size={20} color={TURQUOISE} />
                        </View>
                        <View className="flex-1">
                          <View className="flex-row items-center justify-between">
                            <Text className="text-white font-bold text-base">
                              {getJobTypeLabel(settings.trade, job.type)}
                            </Text>
                            <View className="flex-row items-center">
                              <Clock size={14} color="#64748B" />
                              <Text className="text-slate-400 text-sm ml-1">
                                {formatTime(job.scheduledTime)}
                              </Text>
                            </View>
                          </View>
                          <Text className="text-slate-400 text-sm mt-1">
                            {customer?.name || 'Unknown'}
                          </Text>
                          <View className="flex-row items-center mt-2">
                            <MapPin size={14} color="#64748B" />
                            <Text className="text-slate-500 text-xs ml-1">
                              {customer ? `${customer.address}, ${customer.postcode}` : ''}
                            </Text>
                          </View>

                          {job.quote && (
                            <Text className="text-[#14B8A6] font-bold text-base mt-2">
                              £{job.quote.total.toFixed(2)}
                            </Text>
                          )}
                        </View>
                      </View>

                      {!isInProgress && (
                        <Pressable
                          onPress={() => handleStartJob(job.id)}
                          className="bg-[#14B8A6] rounded-xl p-3 mt-4 flex-row items-center justify-center active:opacity-80"
                        >
                          <Play size={18} color="#FFF" />
                          <Text className="text-white font-bold ml-2">Start Job</Text>
                        </Pressable>
                      )}
                    </View>
                  </Pressable>
                );
              })}
            </View>
          )}
        </Animated.View>
      </View>
    </ScrollView>
  );
}

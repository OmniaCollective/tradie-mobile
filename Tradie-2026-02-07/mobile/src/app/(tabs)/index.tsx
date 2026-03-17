import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  TextInput,
} from 'react-native';
import { useRouter } from 'expo-router';
import {
  MapPin,
  Clock,
  Plus,
  Check,
  Trash2,
  Mic,
  ChevronRight,
  Wrench,
  AlertCircle,
  Calendar,
} from 'lucide-react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useTradeStore, useJobs, useTodos } from '@/lib/store';
import { getJobTypeLabel } from '@/lib/trades';
import { FAB } from '@/components/FAB';

const TURQUOISE = '#14B8A6';

export default function DashboardScreen() {
  const router = useRouter();
  const jobs = useJobs();
  const todos = useTodos();
  const { addTodo, toggleTodo, deleteTodo, updateJob, getCustomer, settings } = useTradeStore();

  const [newTodoText, setNewTodoText] = useState('');

  const today = new Date().toISOString().split('T')[0];

  // Get current job (IN_PROGRESS)
  const currentJob = jobs.find((j) => j.status === 'IN_PROGRESS');

  // Get upcoming jobs (SCHEDULED for today or future)
  const upcomingJobs = jobs
    .filter((j) => j.status === 'SCHEDULED' && j.scheduledDate && j.scheduledDate >= today)
    .sort((a, b) => {
      const dateA = `${a.scheduledDate}T${a.scheduledTime || '00:00'}`;
      const dateB = `${b.scheduledDate}T${b.scheduledTime || '00:00'}`;
      return dateA.localeCompare(dateB);
    })
    .slice(0, 3);

  // Get pending quotes (QUOTED status waiting for customer approval)
  const pendingQuotes = jobs.filter((j) => j.status === 'QUOTED');

  // Get unpaid invoices count
  const unpaidCount = useTradeStore((s) =>
    s.invoices.filter((inv) => inv.status !== 'paid').length
  );

  const handleAddTodo = useCallback(() => {
    if (newTodoText.trim()) {
      addTodo(newTodoText.trim());
      setNewTodoText('');
    }
  }, [newTodoText, addTodo]);

  const handleStartJob = useCallback((jobId: string) => {
    updateJob(jobId, { status: 'IN_PROGRESS' });
  }, [updateJob]);

  const handleCompleteJob = useCallback((jobId: string) => {
    updateJob(jobId, {
      status: 'COMPLETED',
      completedAt: new Date().toISOString(),
    });
  }, [updateJob]);

  const getCustomerName = (customerId: string) => {
    const customer = getCustomer(customerId);
    return customer?.name || 'Unknown';
  };

  const getCustomerAddress = (customerId: string) => {
    const customer = getCustomer(customerId);
    return customer ? `${customer.address}, ${customer.postcode}` : '';
  };

  const formatTime = (time?: string) => {
    if (!time) return '';
    const [hours, minutes] = time.split(':');
    const h = parseInt(hours, 10);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const hour12 = h % 12 || 12;
    return `${hour12}:${minutes} ${ampm}`;
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const isToday = dateStr === today;
    if (isToday) return 'Today';

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    if (dateStr === tomorrow.toISOString().split('T')[0]) return 'Tomorrow';

    return date.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
  };

  return (
    <View className="flex-1">
    <ScrollView className="flex-1 bg-[#0F172A]">
      <View className="px-4 pb-8">
        {/* Spacer for top */}
        <View className="mb-2" />

        {/* Current Job */}
        {currentJob && (
          <Animated.View entering={FadeInDown.delay(200).duration(400)} className="mb-6">
            <Text className="text-slate-400 text-sm font-semibold mb-3 uppercase tracking-wide">
              Current Job
            </Text>
            <View className="bg-[#1E293B] rounded-2xl border border-[#334155] overflow-hidden">
              <View className="bg-[#14B8A6]/20 px-4 py-2 border-b border-[#334155]">
                <View className="flex-row items-center">
                  <View className="w-2 h-2 rounded-full bg-[#14B8A6] mr-2" />
                  <Text className="text-[#14B8A6] font-semibold text-sm">In Progress</Text>
                </View>
              </View>
              <View className="p-4">
                <Text className="text-white font-bold text-lg mb-1">
                  {getJobTypeLabel(settings.trade, currentJob.type)}
                </Text>
                <Text className="text-slate-400 text-sm mb-3">
                  {currentJob.description}
                </Text>

                <View className="flex-row items-center mb-2">
                  <View className="w-8 h-8 rounded-full bg-[#334155] items-center justify-center mr-3">
                    <Text className="text-white font-bold text-sm">
                      {getCustomerName(currentJob.customerId).charAt(0)}
                    </Text>
                  </View>
                  <View className="flex-1">
                    <Text className="text-white font-medium">
                      {getCustomerName(currentJob.customerId)}
                    </Text>
                    <View className="flex-row items-center mt-1">
                      <MapPin size={12} color="#64748B" />
                      <Text className="text-slate-500 text-xs ml-1">
                        {getCustomerAddress(currentJob.customerId)}
                      </Text>
                    </View>
                  </View>
                </View>

                {currentJob.quote && (
                  <View className="bg-[#0F172A] rounded-xl p-3 mt-3">
                    <Text className="text-slate-400 text-xs mb-1">Quote Total</Text>
                    <Text className="text-[#14B8A6] font-bold text-xl">
                      £{currentJob.quote.total.toFixed(2)}
                    </Text>
                  </View>
                )}

                <Pressable
                  onPress={() => handleCompleteJob(currentJob.id)}
                  className="bg-[#14B8A6] rounded-xl p-3 mt-4 flex-row items-center justify-center active:opacity-80"
                >
                  <Check size={18} color="#FFF" />
                  <Text className="text-white font-bold ml-2">Mark Complete</Text>
                </Pressable>
              </View>
            </View>
          </Animated.View>
        )}

        {/* Upcoming Jobs */}
        <Animated.View entering={FadeInDown.delay(300).duration(400)} className="mb-6">
          <View className="flex-row items-center justify-between mb-3">
            <Text className="text-slate-400 text-sm font-semibold uppercase tracking-wide">
              Upcoming Jobs
            </Text>
            <Pressable onPress={() => router.push('/(tabs)/calendar')}>
              <Text className="text-[#14B8A6] text-sm font-medium">View All</Text>
            </Pressable>
          </View>

          {upcomingJobs.length === 0 ? (
            <View className="bg-[#1E293B] rounded-2xl border border-[#334155] p-6 items-center">
              <Calendar size={32} color="#64748B" />
              <Text className="text-slate-500 mt-2">No upcoming jobs scheduled</Text>
            </View>
          ) : (
            <View className="bg-[#1E293B] rounded-2xl border border-[#334155] overflow-hidden">
              {upcomingJobs.map((job, index) => (
                <Pressable
                  key={job.id}
                  onPress={() => router.push(`/job/${job.id}`)}
                  className={`p-4 flex-row items-center active:bg-[#334155] ${
                    index < upcomingJobs.length - 1 ? 'border-b border-[#334155]' : ''
                  }`}
                >
                  <View className="w-12 h-12 rounded-xl bg-[#0F172A] items-center justify-center mr-3">
                    <Wrench size={20} color={TURQUOISE} />
                  </View>
                  <View className="flex-1">
                    <Text className="text-white font-semibold">
                      {getJobTypeLabel(settings.trade, job.type)}
                    </Text>
                    <Text className="text-slate-400 text-sm">
                      {getCustomerName(job.customerId)}
                    </Text>
                    <View className="flex-row items-center mt-1">
                      <Clock size={12} color="#64748B" />
                      <Text className="text-slate-500 text-xs ml-1">
                        {formatDate(job.scheduledDate)} at {formatTime(job.scheduledTime)}
                      </Text>
                    </View>
                  </View>
                  <ChevronRight size={20} color="#64748B" />
                </Pressable>
              ))}
            </View>
          )}
        </Animated.View>

        {/* Pending Quotes */}
        <Animated.View entering={FadeInDown.delay(400).duration(400)} className="mb-6">
          <View className="flex-row items-center justify-between mb-3">
            <Text className="text-slate-400 text-sm font-semibold uppercase tracking-wide">
              Pending Quotes
            </Text>
            {pendingQuotes.length > 0 && (
              <View className="bg-[#8B5CF6]/20 px-2 py-1 rounded-full">
                <Text className="text-[#8B5CF6] text-xs font-bold">{pendingQuotes.length}</Text>
              </View>
            )}
          </View>

          {pendingQuotes.length === 0 ? (
            <View className="bg-[#1E293B] rounded-2xl border border-[#334155] p-6 items-center">
              <Check size={32} color="#22C55E" />
              <Text className="text-slate-500 mt-2">All quotes actioned</Text>
            </View>
          ) : (
            <View className="bg-[#1E293B] rounded-2xl border border-[#334155] overflow-hidden">
              {pendingQuotes.map((job, index) => (
                <Pressable
                  key={job.id}
                  onPress={() => router.push(`/job/${job.id}`)}
                  className={`p-4 flex-row items-center active:bg-[#334155] ${
                    index < pendingQuotes.length - 1 ? 'border-b border-[#334155]' : ''
                  }`}
                >
                  <View className="w-12 h-12 rounded-xl bg-[#8B5CF6]/20 items-center justify-center mr-3">
                    <AlertCircle size={20} color="#8B5CF6" />
                  </View>
                  <View className="flex-1">
                    <Text className="text-white font-semibold">
                      {getJobTypeLabel(settings.trade, job.type)}
                    </Text>
                    <Text className="text-slate-400 text-sm">
                      {getCustomerName(job.customerId)}
                    </Text>
                    {job.quote && (
                      <Text className="text-[#14B8A6] font-bold mt-1">
                        £{job.quote.total.toFixed(2)}
                      </Text>
                    )}
                  </View>
                  <ChevronRight size={20} color="#64748B" />
                </Pressable>
              ))}
            </View>
          )}
        </Animated.View>

        {/* To-Do List */}
        <Animated.View entering={FadeInDown.delay(500).duration(400)} className="mb-6">
          <Text className="text-slate-400 text-sm font-semibold mb-3 uppercase tracking-wide">
            To-Do
          </Text>

          <View className="bg-[#1E293B] rounded-2xl border border-[#334155] overflow-hidden">
            {/* Add Todo Input */}
            <View className="flex-row items-center p-3 border-b border-[#334155]">
              <TextInput
                className="flex-1 bg-[#0F172A] rounded-xl px-4 py-3 text-white mr-2"
                placeholder="Add a note..."
                placeholderTextColor="#64748B"
                value={newTodoText}
                onChangeText={setNewTodoText}
                onSubmitEditing={handleAddTodo}
                returnKeyType="done"
              />
              <Pressable
                onPress={handleAddTodo}
                className="w-12 h-12 rounded-xl bg-[#14B8A6] items-center justify-center active:opacity-80"
              >
                <Plus size={20} color="#FFF" />
              </Pressable>
            </View>

            {/* Todo Items */}
            {todos.length === 0 ? (
              <View className="p-6 items-center">
                <Text className="text-slate-500">No tasks yet</Text>
              </View>
            ) : (
              todos.slice(0, 5).map((todo, index) => (
                <View
                  key={todo.id}
                  className={`flex-row items-center p-4 ${
                    index < Math.min(todos.length, 5) - 1 ? 'border-b border-[#334155]' : ''
                  }`}
                >
                  <Pressable
                    onPress={() => toggleTodo(todo.id)}
                    className={`w-6 h-6 rounded-full border-2 mr-3 items-center justify-center ${
                      todo.completed
                        ? 'bg-[#14B8A6] border-[#14B8A6]'
                        : 'border-[#64748B]'
                    }`}
                  >
                    {todo.completed && <Check size={14} color="#FFF" />}
                  </Pressable>
                  <Text
                    className={`flex-1 ${
                      todo.completed ? 'text-slate-500 line-through' : 'text-white'
                    }`}
                  >
                    {todo.text}
                  </Text>
                  {todo.isVoiceNote && <Mic size={16} color="#64748B" className="mr-2" />}
                  <Pressable
                    onPress={() => deleteTodo(todo.id)}
                    className="p-2 active:opacity-50"
                  >
                    <Trash2 size={16} color="#EF4444" />
                  </Pressable>
                </View>
              ))
            )}
          </View>
        </Animated.View>

        {/* Quick Stats */}
        <Animated.View entering={FadeInDown.delay(600).duration(400)} className="flex-row gap-3">
          <Pressable
            onPress={() => router.push('/(tabs)/invoices')}
            className="flex-1 bg-[#1E293B] rounded-2xl border border-[#334155] p-4 active:opacity-80"
          >
            <Text className="text-slate-400 text-xs mb-1">Unpaid</Text>
            <Text className="text-white font-bold text-2xl">{unpaidCount}</Text>
            <Text className="text-slate-500 text-xs">invoices</Text>
          </Pressable>
          <View className="flex-1 bg-[#1E293B] rounded-2xl border border-[#334155] p-4">
            <Text className="text-slate-400 text-xs mb-1">This Week</Text>
            <Text className="text-white font-bold text-2xl">{upcomingJobs.length}</Text>
            <Text className="text-slate-500 text-xs">jobs booked</Text>
          </View>
        </Animated.View>
      </View>

    </ScrollView>
    <FAB onPress={() => router.push('/add-job')} label={jobs.length === 0 ? 'Add your first job' : undefined} />
    </View>
  );
}

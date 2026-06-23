import { View, Text, TouchableOpacity } from 'react-native';
import { ServiceStatus } from '@/types';
import { AlertTriangle, CheckCircle, Clock } from 'lucide-react-native';
import { getStatusSubtitle, getDueDetail } from '@/lib/serviceCardLabels';

interface Props {
  title: string;
  status: ServiceStatus;
  onSchedule: () => void;
  onNoRecord?: () => void;
  noRecordLabel?: string;
  isScheduled?: boolean;
  scheduledDate?: string;
  onLongPress?: () => void;
}

export function ServiceDueCard({ title, status, onSchedule, onNoRecord, noRecordLabel, isScheduled, scheduledDate, onLongPress }: Props) {
  const scheduledNotYetDue = isScheduled && !status.isDue && !status.isOverdue && !status.noRecord;
  const bgColor = status.isOverdue
    ? 'bg-red-50 dark:bg-[#2c1516]'
    : (status.isDue || scheduledNotYetDue)
    ? 'bg-yellow-50 dark:bg-[#2a2310]'
    : 'bg-green-50 dark:bg-[#0d2418]';
  const borderColor = status.isOverdue
    ? 'border-red-200 dark:border-[#5c2323]'
    : (status.isDue || scheduledNotYetDue)
    ? 'border-yellow-200 dark:border-[#574a1a]'
    : 'border-green-200 dark:border-[#1a4a2e]';
  const Icon = status.isOverdue ? AlertTriangle : (status.isDue || scheduledNotYetDue) ? Clock : CheckCircle;
  const iconColor = status.isOverdue ? '#ef4444' : (status.isDue || scheduledNotYetDue) ? '#f59e0b' : '#22c55e';

  const subtitle = getStatusSubtitle(status, { isScheduled, scheduledNotYetDue });
  const dueDetail = getDueDetail(status);

  return (
    <TouchableOpacity
      activeOpacity={onLongPress ? 0.7 : 1}
      onLongPress={onLongPress}
      delayLongPress={400}
      className={`${bgColor} ${borderColor} border rounded-2xl p-4 mb-3`}
    >
      <View className="flex-row items-center mb-2">
        <Icon size={18} color={iconColor} />
        <Text className="font-semibold text-gray-900 dark:text-white ml-2">{title}</Text>
      </View>
      <Text className="text-sm text-gray-600 dark:text-[#ebebf5cc] mb-0.5">{subtitle}</Text>
      {isScheduled && (status.isOverdue || scheduledNotYetDue) && scheduledDate && (
        <Text className="text-xs text-gray-400 dark:text-[#636366] mb-2">
          Scheduled {new Date(scheduledDate + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
        </Text>
      )}
      {!status.noRecord && !(isScheduled && status.isDue && !status.isOverdue) && !(isScheduled && status.isOverdue) && !scheduledNotYetDue && dueDetail && (
        <Text className="text-xs text-gray-400 dark:text-[#636366] mb-2">{dueDetail}</Text>
      )}
      {(status.noRecord || (isScheduled && (status.isDue || status.isOverdue || scheduledNotYetDue)) || (!status.dueDate && status.dueMileage === null)) && <View className="mb-2" />}
      {onNoRecord && (
        <TouchableOpacity
          className="bg-white dark:bg-[#2c2c2e] border border-gray-200 dark:border-[#3a3a3c] rounded-xl py-2 items-center"
          onPress={onNoRecord}
        >
          <Text className="text-blue-600 dark:text-[#0a84ff] font-medium text-sm">{noRecordLabel ?? 'Log Service Date'}</Text>
        </TouchableOpacity>
      )}
      {!onNoRecord && !isScheduled && (status.isDue || status.isOverdue) && (
        <TouchableOpacity
          className="bg-white dark:bg-[#2c2c2e] border border-gray-200 dark:border-[#3a3a3c] rounded-xl py-2 items-center"
          onPress={onSchedule}
        >
          <Text className="text-blue-600 dark:text-[#0a84ff] font-medium text-sm">Schedule Service</Text>
        </TouchableOpacity>
      )}
    </TouchableOpacity>
  );
}

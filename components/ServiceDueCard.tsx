import { View, Text, TouchableOpacity } from 'react-native';
import { ServiceStatus } from '@/types';
import { AlertTriangle, CheckCircle, Clock } from 'lucide-react-native';

interface Props {
  title: string;
  status: ServiceStatus;
  onSchedule: () => void;
  onNoRecord?: () => void;
  noRecordLabel?: string;
  isScheduled?: boolean;
}

export function ServiceDueCard({ title, status, onSchedule, onNoRecord, noRecordLabel, isScheduled }: Props) {
  const bgColor = status.isOverdue ? 'bg-red-50' : status.isDue ? 'bg-yellow-50' : 'bg-green-50';
  const borderColor = status.isOverdue ? 'border-red-200' : status.isDue ? 'border-yellow-200' : 'border-green-200';
  const Icon = status.isOverdue ? AlertTriangle : status.isDue ? Clock : CheckCircle;
  const iconColor = status.isOverdue ? '#ef4444' : status.isDue ? '#f59e0b' : '#22c55e';

  function getSubtitle() {
    if (status.noRecord) return 'No record found';
    if (isScheduled && status.isDue && !status.isOverdue) return 'Maintenance scheduled';
    if (status.isOverdue) {
      if (status.milesUntilDue !== null) return `${Math.abs(status.milesUntilDue).toLocaleString()} miles overdue`;
      if (status.daysUntilDue !== null) return `${Math.abs(status.daysUntilDue)} days overdue`;
      return 'Overdue';
    }
    if (status.isDue) {
      if (status.milesUntilDue !== null) return `Due in ${status.milesUntilDue.toLocaleString()} miles`;
      if (status.daysUntilDue !== null) return `Due in ${status.daysUntilDue} days`;
      return 'Due soon';
    }
    return 'Up to date';
  }

  return (
    <View className={`${bgColor} ${borderColor} border rounded-2xl p-4 mb-3`}>
      <View className="flex-row items-center mb-2">
        <Icon size={18} color={iconColor} />
        <Text className="font-semibold text-gray-900 ml-2">{title}</Text>
      </View>
      <Text className="text-sm text-gray-600 mb-0.5">{getSubtitle()}</Text>
      {!status.noRecord && !(isScheduled && status.isDue && !status.isOverdue) && (status.dueDate || status.dueMileage !== null) && (
        <Text className="text-xs text-gray-400 mb-2">
          {status.dueMileage !== null
            ? `${status.isOverdue ? 'Was due at' : 'Next due at'} ${status.dueMileage.toLocaleString()} mi`
            : `${status.isOverdue ? 'Was due' : status.isDue ? 'Due' : 'Next due'} ${status.dueDate!.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
          }
        </Text>
      )}
      {(status.noRecord || (isScheduled && status.isDue && !status.isOverdue) || (!status.dueDate && status.dueMileage === null)) && <View className="mb-2" />}
      {onNoRecord && (
        <TouchableOpacity
          className="bg-white border border-gray-200 rounded-xl py-2 items-center"
          onPress={onNoRecord}
        >
          <Text className="text-blue-600 font-medium text-sm">{noRecordLabel ?? 'Log Service Date'}</Text>
        </TouchableOpacity>
      )}
      {!onNoRecord && !(isScheduled && !status.isOverdue) && (status.isDue || status.isOverdue) && (
        <TouchableOpacity
          className="bg-white border border-gray-200 rounded-xl py-2 items-center"
          onPress={onSchedule}
        >
          <Text className="text-blue-600 font-medium text-sm">Schedule Service</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

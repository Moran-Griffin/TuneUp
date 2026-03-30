import { View, Text, TouchableOpacity } from 'react-native';
import { ServiceStatus } from '@/types';
import { AlertTriangle, CheckCircle, Clock } from 'lucide-react-native';

interface Props {
  title: string;
  status: ServiceStatus;
  onSchedule: () => void;
}

export function ServiceDueCard({ title, status, onSchedule }: Props) {
  const bgColor = status.isOverdue ? 'bg-red-50' : status.isDue ? 'bg-yellow-50' : 'bg-green-50';
  const borderColor = status.isOverdue ? 'border-red-200' : status.isDue ? 'border-yellow-200' : 'border-green-200';
  const Icon = status.isOverdue ? AlertTriangle : status.isDue ? Clock : CheckCircle;
  const iconColor = status.isOverdue ? '#ef4444' : status.isDue ? '#f59e0b' : '#22c55e';

  function getSubtitle() {
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
      <Text className="text-sm text-gray-600 mb-3">{getSubtitle()}</Text>
      {(status.isDue || status.isOverdue) && (
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

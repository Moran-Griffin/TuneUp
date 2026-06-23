import { ServiceStatus } from '@/types';

const MS_PER_DAY = 1000 * 60 * 60 * 24;

function formatDueDate(d: Date): string {
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// True only when the mileage track itself is past due. Oil change is the one
// service with both a mileage and a time track; when it's overdue by time but
// not by mileage, `milesUntilDue` is still positive (miles remaining).
function isMileageOverdue(status: ServiceStatus): boolean {
  return status.milesUntilDue !== null && status.milesUntilDue < 0;
}

export function getStatusSubtitle(
  status: ServiceStatus,
  opts: { isScheduled?: boolean; scheduledNotYetDue?: boolean } = {}
): string {
  const { isScheduled, scheduledNotYetDue } = opts;
  if (status.noRecord) return 'No record found';
  if (isScheduled && scheduledNotYetDue) return 'Maintenance scheduled';
  if (isScheduled && status.isDue && !status.isOverdue) return 'Maintenance scheduled';
  if (isScheduled && status.isOverdue) return 'Overdue — appointment scheduled';

  const mileageOverdue = isMileageOverdue(status);

  if (status.isOverdue) {
    // Only describe it as "miles overdue" when the mileage track is the cause.
    if (mileageOverdue) return `${Math.abs(status.milesUntilDue!).toLocaleString()} miles overdue`;
    if (status.daysUntilDue !== null) return `${Math.abs(status.daysUntilDue)} days overdue`;
    // Oil change overdue by time: daysUntilDue isn't populated, so derive it
    // from the due date the time track produced.
    if (status.dueDate) {
      const days = Math.floor((Date.now() - status.dueDate.getTime()) / MS_PER_DAY);
      if (days > 0) return `${days.toLocaleString()} days overdue`;
    }
    return 'Overdue';
  }
  if (status.isDue) {
    if (status.milesUntilDue !== null) return `Due in ${status.milesUntilDue.toLocaleString()} miles`;
    if (status.daysUntilDue !== null) return `Due in ${status.daysUntilDue} days`;
    return 'Due soon';
  }
  return 'Up to date';
}

// Secondary detail line. For mileage-based services (oil) it normally shows the
// due mileage, but when the overdue cause is the time track it shows the date
// that triggered it instead of a misleading "Was due at <mileage>".
export function getDueDetail(status: ServiceStatus): string | null {
  const mileageOverdue = isMileageOverdue(status);

  if (status.dueMileage !== null) {
    if (status.isOverdue && !mileageOverdue && status.dueDate) {
      return `Was due ${formatDueDate(status.dueDate)}`;
    }
    return `${mileageOverdue ? 'Was due at' : 'Next due at'} ${status.dueMileage.toLocaleString()} mi`;
  }
  if (status.dueDate) {
    return `${status.isOverdue ? 'Was due' : status.isDue ? 'Due' : 'Next due'} ${formatDueDate(status.dueDate)}`;
  }
  return null;
}

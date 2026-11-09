import { MaintenanceLog, ServiceType } from '@/types';
import { SERVICE_TYPE_LABELS } from '@/constants/maintenance';

/** Label shown in lists: the custom name for "Other" entries, else the standard label. */
export function logTypeLabel(entry: { type: ServiceType; custom_label?: string | null }): string {
  if (entry.type === 'other') {
    const label = entry.custom_label?.trim();
    if (label) return label;
  }
  return SERVICE_TYPE_LABELS[entry.type];
}

/** Value to persist in custom_label: trimmed text for "Other", otherwise null. */
export function normalizeCustomLabel(type: ServiceType, label: string | null | undefined): string | null {
  if (type !== 'other') return null;
  const trimmed = label?.trim();
  return trimmed ? trimmed : null;
}

/** Previously used custom names, most recent first, deduped case-insensitively. */
export function recentCustomLabels(
  logs: Pick<MaintenanceLog, 'type' | 'custom_label' | 'date'>[],
  limit = 5
): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  const sorted = [...logs].sort((a, b) => b.date.localeCompare(a.date));
  for (const log of sorted) {
    const label = normalizeCustomLabel(log.type, log.custom_label);
    if (!label) continue;
    const key = label.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(label);
    if (out.length >= limit) break;
  }
  return out;
}

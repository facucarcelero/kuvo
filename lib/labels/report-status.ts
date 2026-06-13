import type { ReportRow } from '@/lib/database.types';

const LABELS: Record<ReportRow['status'], string> = {
  open: 'Abierto',
  reviewing: 'En revisión',
  resolved: 'Resuelto',
  dismissed: 'Descartado',
};

export function reportStatusLabel(status: ReportRow['status']) {
  return LABELS[status] ?? status;
}

export function adminCanResolveReport(status: ReportRow['status']) {
  return status === 'open' || status === 'reviewing';
}

export function adminCanDismissReport(status: ReportRow['status']) {
  return status === 'open' || status === 'reviewing';
}

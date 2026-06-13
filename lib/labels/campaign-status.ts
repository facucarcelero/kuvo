import type { Campaign } from '@/lib/types';

const LABELS: Record<Campaign['status'], string> = {
  draft: 'Borrador',
  open: 'Activa',
  paused: 'Pausada',
  in_progress: 'En curso',
  completed: 'Completada',
  cancelled: 'Cancelada',
};

export function campaignStatusLabel(status: Campaign['status']) {
  return LABELS[status] ?? status;
}

export function businessCanPause(status: Campaign['status']) {
  return status === 'open';
}

export function businessCanReopen(status: Campaign['status']) {
  return status === 'paused';
}

export function businessCanCancel(status: Campaign['status']) {
  return status === 'open' || status === 'paused' || status === 'in_progress';
}

export function businessCanComplete(status: Campaign['status']) {
  return status === 'in_progress';
}

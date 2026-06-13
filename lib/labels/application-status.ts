import type { Application } from '@/lib/types';

const LABELS: Record<Application['status'], string> = {
  pending: 'Pendiente',
  shortlisted: 'Preseleccionada',
  accepted: 'Aceptada',
  rejected: 'Rechazada',
  withdrawn: 'Retirada',
};

export function applicationStatusLabel(status: Application['status']) {
  return LABELS[status] ?? status;
}

export function businessCanShortlist(status: Application['status']) {
  return status === 'pending';
}

export function businessCanAccept(status: Application['status']) {
  return status === 'pending' || status === 'shortlisted';
}

export function businessCanReject(status: Application['status']) {
  return status === 'pending' || status === 'shortlisted';
}

export function creatorCanWithdraw(status: Application['status']) {
  return status === 'pending';
}

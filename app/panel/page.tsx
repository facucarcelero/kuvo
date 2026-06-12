import type { Metadata } from 'next';
import { Dashboard } from '@/components/Dashboard';
export const metadata: Metadata = { title:'Panel' };
export default function PanelPage(){return <Dashboard/>}

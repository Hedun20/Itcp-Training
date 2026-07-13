import { useCallback, useState } from 'react';
import { BookCopy, Gauge, Image, UsersRound, ClipboardCheck } from 'lucide-react';
import { TrainingShell } from './TrainingShell';

const navigation = [
  { to: '/admin', label: 'Overview', icon: Gauge, end: true },
  { to: '/admin/courses', label: 'Courses', icon: BookCopy },
  { to: '/admin/media', label: 'Media library', icon: Image },
  { to: '/admin/users', label: 'Users', icon: UsersRound },
  { to: '/admin/results', label: 'Results', icon: ClipboardCheck },
];

export function AdminShell() {
  const [mobileOpen, setMobileOpenState] = useState(false);
  const setMobileOpen = useCallback((value) => setMobileOpenState(value), []);
  return <TrainingShell navigation={navigation} mobileOpen={mobileOpen} setMobileOpen={setMobileOpen} roleLabel="Admin" navLabel="Admin navigation" />;
}

import { useCallback, useState } from 'react';
import { BookOpen, Gauge, GraduationCap, History, UserRound } from 'lucide-react';
import { TrainingShell } from './TrainingShell';

const navigation = [
  { to: '/dashboard', label: 'Overview', icon: Gauge },
  { to: '/courses', label: 'Course catalog', icon: BookOpen },
  { to: '/progress', label: 'My progress', icon: GraduationCap },
  { to: '/history', label: 'Attempt history', icon: History },
  { to: '/profile', label: 'Profile', icon: UserRound },
];

export function LearnerShell() {
  const [mobileOpen, setMobileOpenState] = useState(false);
  const setMobileOpen = useCallback((value) => setMobileOpenState(value), []);
  return <TrainingShell navigation={navigation} mobileOpen={mobileOpen} setMobileOpen={setMobileOpen} roleLabel="Learner" navLabel="Learner navigation" />;
}

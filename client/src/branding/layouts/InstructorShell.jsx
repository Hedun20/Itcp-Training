import { useCallback, useState } from 'react';
import { BookCopy, ChartNoAxesColumnIncreasing, Image } from 'lucide-react';
import { TrainingShell } from './TrainingShell';

const navigation = [
  { to: '/instructor/courses', label: 'My courses', icon: BookCopy },
  { to: '/instructor/media', label: 'Course media', icon: Image },
  { to: '/instructor/progress', label: 'Learner progress', icon: ChartNoAxesColumnIncreasing },
];

export function InstructorShell() {
  const [mobileOpen, setMobileOpenState] = useState(false);
  const setMobileOpen = useCallback((value) => setMobileOpenState(value), []);
  return <TrainingShell navigation={navigation} mobileOpen={mobileOpen} setMobileOpen={setMobileOpen} roleLabel="Instructor" navLabel="Instructor navigation" />;
}

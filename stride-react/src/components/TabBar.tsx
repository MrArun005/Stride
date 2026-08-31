import { IcoRun, IcoHistory, IcoSegments, IcoProgress } from './icons';

export type Tab = 'run' | 'history' | 'segments' | 'progress';

const TABS: { id: Tab; label: string; icon: () => React.ReactNode }[] = [
  { id: 'run', label: 'Run', icon: IcoRun },
  { id: 'history', label: 'History', icon: IcoHistory },
  { id: 'segments', label: 'Segments', icon: IcoSegments },
  { id: 'progress', label: 'Progress', icon: IcoProgress },
];

export default function TabBar({ tab, onTab }: { tab: Tab; onTab: (t: Tab) => void }) {
  return (
    <nav id="tabbar">
      {TABS.map(t => (
        <button key={t.id} data-tab={t.id} className={tab === t.id ? 'on' : ''} onClick={() => onTab(t.id)}>
          {t.icon()}{t.label}
        </button>
      ))}
    </nav>
  );
}

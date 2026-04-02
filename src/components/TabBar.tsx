export type Tab = 'learn' | 'solve' | 'details' | 'print';

interface TabBarProps {
  active: Tab;
  onChange: (tab: Tab) => void;
}

const isDev = import.meta.env.VITE_APP_ENV === 'dev';

const BASE_TABS: { id: Tab; label: string }[] = [
  { id: 'learn', label: 'Learn' },
  { id: 'solve', label: 'Solve' },
  { id: 'details', label: 'Details' },
];

const TABS = isDev
  ? [...BASE_TABS, { id: 'print' as Tab, label: 'Print' }]
  : BASE_TABS;

export default function TabBar({ active, onChange }: TabBarProps) {
  return (
    <nav className="tab-bar">
      {TABS.map((tab) => (
        <button
          key={tab.id}
          className={`tab-btn ${active === tab.id ? 'active' : ''}`}
          onClick={() => onChange(tab.id)}
        >
          {tab.label}
        </button>
      ))}
    </nav>
  );
}

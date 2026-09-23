import { GraduationCap, Lock, Shield, Swords } from 'lucide-react';
import { useGame, useLevel, type Tab } from '../store/gameStore';
import { GUILD_UNLOCK_LEVEL } from '../data/levels';
import { sfx } from '../audio/sfx';

const ITEMS: { id: Tab; label: string; Icon: typeof Swords }[] = [
  { id: 'academy', label: 'アイドマ学園', Icon: GraduationCap },
  { id: 'guild', label: '冒険者ギルド', Icon: Swords },
  { id: 'hero', label: '勇者・転職', Icon: Shield },
];

export function BottomNav() {
  const tab = useGame((s) => s.tab);
  const setTab = useGame((s) => s.setTab);
  const level = useLevel();

  return (
    <nav className="safe-bottom safe-x fixed inset-x-0 bottom-0 z-30 border-t border-white/10 bg-night-900/95 backdrop-blur">
      <div className="mx-auto grid max-w-3xl grid-cols-3">
        {ITEMS.map(({ id, label, Icon }) => {
          const locked = id === 'guild' && level < GUILD_UNLOCK_LEVEL;
          const active = tab === id;
          return (
            <button
              key={id}
              onClick={() => {
                sfx.select();
                setTab(id);
              }}
              className={`relative flex flex-col items-center gap-0.5 py-2 text-[11px] font-bold transition-colors ${
                active ? 'text-gold-300' : 'text-indigo-200/70'
              }`}
              aria-current={active ? 'page' : undefined}
            >
              {active && <span className="absolute inset-x-6 top-0 h-0.5 rounded-full bg-gold-400" />}
              <span className="relative">
                <Icon className={`h-6 w-6 ${active ? 'drop-shadow-[0_0_6px_#ffd166]' : ''}`} />
                {locked && (
                  <span className="absolute -right-2 -top-1 grid h-4 w-4 place-items-center rounded-full bg-rose-500">
                    <Lock className="h-2.5 w-2.5" />
                  </span>
                )}
              </span>
              {label}
            </button>
          );
        })}
      </div>
    </nav>
  );
}

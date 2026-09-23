import type { ReactNode } from 'react';

export function Bar({ value, max, color, className = '', height = 'h-2.5' }: { value: number; max: number; color: string; className?: string; height?: string }) {
  const pct = Math.max(0, Math.min(100, (value / Math.max(1, max)) * 100));
  return (
    <div className={`relative w-full overflow-hidden rounded-full bg-black/50 ring-1 ring-white/15 ${height} ${className}`}>
      <div
        className="absolute inset-y-0 left-0 rounded-full transition-[width] duration-500 ease-out"
        style={{ width: `${pct}%`, background: color }}
      />
      <div className="absolute inset-x-0 top-0 h-1/2 bg-white/15" />
    </div>
  );
}

export function Stars({ count, max = 4, color = '#ffd166' }: { count: number; max?: number; color?: string }) {
  return (
    <span className="inline-flex gap-0.5" aria-label={`難易度 ${count}`}>
      {Array.from({ length: max }, (_, i) => (
        <span key={i} style={{ color: i < count ? color : '#ffffff33' }}>★</span>
      ))}
    </span>
  );
}

export function Modal({ children, onClose, className = '' }: { children: ReactNode; onClose?: () => void; className?: string }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-3 backdrop-blur-sm sm:items-center safe-bottom"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose?.();
      }}
    >
      <div className={`anim-pop max-h-[92dvh] w-full max-w-lg overflow-y-auto overflow-x-hidden ${className}`}>{children}</div>
    </div>
  );
}

export function PixelTitle({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <h2 className={`font-pixel tracking-wider text-shadow-rpg ${className}`}>{children}</h2>;
}

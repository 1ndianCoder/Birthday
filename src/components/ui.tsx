import { createContext, useCallback, useContext, useEffect, useState, type ButtonHTMLAttributes, type ReactNode } from 'react';

/* ---------- Button ---------- */
type Variant = 'primary' | 'accent' | 'ghost' | 'danger' | 'quiet';
const variants: Record<Variant, string> = {
  primary: 'bg-volt text-white shadow-[0_8px_24px_-8px_rgba(46,139,255,.8)] hover:bg-[#4a9bff]',
  accent: 'bg-flare text-base shadow-[0_8px_24px_-8px_rgba(255,138,31,.8)] hover:bg-[#ff9a3c]',
  ghost: 'bg-deck2 text-ink border border-line hover:border-mute/60',
  danger: 'bg-bad/15 text-bad border border-bad/40 hover:bg-bad/25',
  quiet: 'text-voltsoft hover:text-white',
};

export function Button({ variant = 'primary', size = 'md', loading, className = '', children, ...rest }:
  ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: 'sm' | 'md' | 'lg'; loading?: boolean }) {
  const sizes = { sm: 'h-9 px-3 text-[13px]', md: 'h-12 px-4 text-[15px]', lg: 'h-14 px-5 text-base' };
  return (
    <button className={`btn ${variants[variant]} ${sizes[size]} ${className}`} disabled={loading || rest.disabled} {...rest}>
      {loading ? <span className="h-4 w-4 rounded-full border-2 border-current border-r-transparent animate-spin" /> : null}
      {children}
    </button>
  );
}

/* ---------- Pill ---------- */
export function Pill({ tone = 'mute', children, live }: { tone?: 'mute' | 'volt' | 'flare' | 'ok' | 'bad'; children: ReactNode; live?: boolean }) {
  const tones = {
    mute: 'text-mute bg-deck2 border-line',
    volt: 'text-voltsoft bg-volt/10 border-volt/30',
    flare: 'text-flare bg-flare/10 border-flare/30',
    ok: 'text-ok bg-ok/10 border-ok/30',
    bad: 'text-bad bg-bad/10 border-bad/30',
  };
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[12px] font-bold ${tones[tone]}`}>
      {live !== undefined && <span className={`h-1.5 w-1.5 rounded-full bg-current ${live ? 'live-dot' : 'opacity-60'}`} />}
      {children}
    </span>
  );
}

/* ---------- Avatar ---------- */
export function Avatar({ emoji, size = 40, online, ring }: { emoji: string; size?: number; online?: boolean; ring?: string }) {
  return (
    <span className="relative inline-grid place-items-center shrink-0 rounded-full bg-deck2"
      style={{ width: size, height: size, fontSize: size * 0.55, boxShadow: `inset 0 0 0 2px ${ring ?? '#2A3142'}` }}>
      {emoji}
      {online !== undefined && (
        <span className={`absolute -right-0.5 -bottom-0.5 h-3 w-3 rounded-full border-2 border-deck ${online ? 'bg-ok' : 'bg-mute/60'}`} />
      )}
    </span>
  );
}

/* ---------- Sheet (bottom sheet on phones, dialog on desktop) ---------- */
export function Sheet({ open, onClose, title, children, wide }: { open: boolean; onClose: () => void; title: string; children: ReactNode; wide?: boolean }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[1000] flex items-end sm:items-center justify-center" role="dialog" aria-modal="true" aria-label={title}>
      <button className="absolute inset-0 bg-black/60 backdrop-blur-[2px]" onClick={onClose} aria-label="Close" />
      <div className={`sheet-in relative w-full ${wide ? 'sm:max-w-2xl' : 'sm:max-w-md'} max-h-[92vh] overflow-y-auto bg-deck border border-line rounded-t-3xl sm:rounded-3xl safe-bottom`}>
        <div className="sticky top-0 z-10 flex items-center justify-between gap-3 bg-deck/95 backdrop-blur px-5 pt-4 pb-3 border-b border-line">
          <h2 className="display text-lg font-bold">{title}</h2>
          <button onClick={onClose} className="h-9 w-9 rounded-full bg-deck2 text-mute grid place-items-center text-lg" aria-label="Close">×</button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

/* ---------- Toasts ---------- */
interface Toast { id: number; text: string; tone: 'ok' | 'bad' | 'info' }
const ToastCtx = createContext<(text: string, tone?: Toast['tone']) => void>(() => undefined);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const push = useCallback((text: string, tone: Toast['tone'] = 'info') => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, text, tone }]);
    window.setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4200);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 top-0 z-[2000] flex flex-col items-center gap-2 px-4 safe-top" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`sheet-in pointer-events-auto max-w-sm w-full rounded-2xl border px-4 py-3 text-sm font-semibold shadow-2xl backdrop-blur
            ${t.tone === 'ok' ? 'bg-ok/15 border-ok/40 text-ok' : t.tone === 'bad' ? 'bg-[#2a1218]/95 border-bad/50 text-[#ffb3bd]' : 'bg-deck2/95 border-line text-ink'}`}>
            {t.text}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}
export const useToast = () => useContext(ToastCtx);

/* ---------- Ticking clock ---------- */
export function useNow(ms = 1000) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), ms);
    return () => window.clearInterval(t);
  }, [ms]);
  return now;
}

/* ---------- Bottom tab bar ---------- */
export function TabBar<T extends string>({ tabs, value, onChange }: { tabs: { id: T; label: string; icon: ReactNode; badge?: boolean }[]; value: T; onChange: (t: T) => void }) {
  return (
    <nav className="fixed bottom-0 inset-x-0 z-[500] border-t border-line bg-base/90 backdrop-blur-xl safe-bottom">
      <div className="mx-auto max-w-2xl grid" style={{ gridTemplateColumns: `repeat(${tabs.length}, 1fr)` }}>
        {tabs.map((t) => (
          <button key={t.id} onClick={() => onChange(t.id)} aria-current={value === t.id ? 'page' : undefined}
            className={`relative flex flex-col items-center gap-1 pt-2.5 pb-1.5 text-[11px] font-bold transition ${value === t.id ? 'text-ink' : 'text-mute'}`}>
            <span className={`h-6 w-6 ${value === t.id ? 'text-volt' : ''}`}>{t.icon}</span>
            {t.label}
            {t.badge && <span className="absolute top-2 right-[calc(50%-18px)] h-2.5 w-2.5 rounded-full bg-bad" />}
          </button>
        ))}
      </div>
    </nav>
  );
}

/* ---------- Icons (inline, no icon font needed) ---------- */
const I = (d: ReactNode) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-full w-full">{d}</svg>;
export const Icons = {
  clue: I(<><path d="M12 3l8 4.5v9L12 21l-8-4.5v-9z" /><path d="M12 8v5" /><circle cx="12" cy="16" r=".5" fill="currentColor" /></>),
  map: I(<><path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2z" /><path d="M9 4v14M15 6v14" /></>),
  trophy: I(<><path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0z" /><path d="M17 5h3a3 3 0 0 1-3 4M7 5H4a3 3 0 0 0 3 4" /></>),
  shield: I(<><path d="M12 3l8 3v6c0 4.5-3.4 8.3-8 9-4.6-.7-8-4.5-8-9V6z" /><path d="M9 12l2 2 4-4" /></>),
  control: I(<><circle cx="12" cy="12" r="9" /><path d="M10 9v6l5-3z" fill="currentColor" /></>),
  route: I(<><circle cx="6" cy="19" r="2" /><circle cx="18" cy="5" r="2" /><path d="M8 19h7a3.5 3.5 0 0 0 0-7H9a3.5 3.5 0 0 1 0-7h7" /></>),
  people: I(<><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20a6.5 6.5 0 0 1 13 0" /><path d="M16 4.5a3.5 3.5 0 0 1 0 7M21.5 20a6.5 6.5 0 0 0-4-6" /></>),
  gear: I(<><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 0 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 0 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 0 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 0 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" /></>),
  pin: I(<><path d="M12 21s-7-6.1-7-11a7 7 0 0 1 14 0c0 4.9-7 11-7 11z" /><circle cx="12" cy="10" r="2.5" /></>),
};

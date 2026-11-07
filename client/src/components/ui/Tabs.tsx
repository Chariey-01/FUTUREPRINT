import { useId, useRef, type KeyboardEvent, type ReactNode } from 'react';

export interface TabItem<T extends string> {
  id: T;
  label: string;
  panel: ReactNode;
}

interface Props<T extends string> {
  label: string;
  items: TabItem<T>[];
  value: T;
  onChange: (id: T) => void;
}

/** WAI-ARIA tabs: arrow keys move between tabs, only the active tab is in the tab order. */
export function Tabs<T extends string>({ label, items, value, onChange }: Props<T>) {
  const base = useId();
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  const onKey = (e: KeyboardEvent, index: number) => {
    const delta = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
    const target = e.key === 'Home' ? 0 : e.key === 'End' ? items.length - 1 : index + delta;
    if (target === index || (delta === 0 && e.key !== 'Home' && e.key !== 'End')) return;
    e.preventDefault();
    const next = (target + items.length) % items.length;
    onChange(items[next]!.id);
    refs.current[next]?.focus();
  };

  return (
    <div>
      <div role="tablist" aria-label={label} className="inline-flex rounded-full bg-midnight/5 p-1">
        {items.map((item, i) => {
          const selected = item.id === value;
          return (
            <button
              key={item.id}
              ref={(el) => (refs.current[i] = el)}
              role="tab"
              type="button"
              id={`${base}-tab-${item.id}`}
              aria-selected={selected}
              aria-controls={`${base}-panel-${item.id}`}
              tabIndex={selected ? 0 : -1}
              onClick={() => onChange(item.id)}
              onKeyDown={(e) => onKey(e, i)}
              className={`min-h-[44px] rounded-full px-5 text-sm font-semibold transition-colors ${
                selected ? 'bg-midnight text-ivory-50' : 'text-midnight hover:bg-midnight/10'
              }`}
            >
              {item.label}
            </button>
          );
        })}
      </div>
      {items.map((item) => (
        <div
          key={item.id}
          role="tabpanel"
          id={`${base}-panel-${item.id}`}
          aria-labelledby={`${base}-tab-${item.id}`}
          hidden={item.id !== value}
          className="mt-8"
        >
          {item.id === value && item.panel}
        </div>
      ))}
    </div>
  );
}

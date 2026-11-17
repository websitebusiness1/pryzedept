import { ReactNode, useState } from 'react';

export interface SortControls { index: number; isFirst: boolean; isLast: boolean; moveUp: () => void; moveDown: () => void; dragging: boolean; over: boolean }

interface Props<T> {
  items: T[];
  getKey: (item: T) => string;
  onReorder: (next: T[]) => void;
  render: (item: T, controls: SortControls) => ReactNode;
  className?: string;
  disabled?: boolean;
}

/**
 * Drag-and-drop reordering for desktop, plus move up/down buttons (via `controls`) that work on phones,
 * touch screens and with a keyboard, where browser drag-and-drop isn't available.
 */
export default function SortableList<T>({ items, getKey, onReorder, render, className = '', disabled }: Props<T>) {
  const [dragKey, setDragKey] = useState<string | null>(null);
  const [overKey, setOverKey] = useState<string | null>(null);

  const move = (from: number, to: number) => {
    if (disabled || from === to || to < 0 || to >= items.length) return;
    const next = [...items];
    const [m] = next.splice(from, 1);
    next.splice(to, 0, m);
    onReorder(next);
  };

  return (
    <ul className={className}>
      {items.map((item, i) => {
        const key = getKey(item);
        return (
          <li
            key={key}
            draggable={!disabled}
            onDragStart={(e) => { setDragKey(key); e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', key); }}
            onDragOver={(e) => { if (dragKey) { e.preventDefault(); setOverKey(key); } }}
            onDrop={(e) => { e.preventDefault(); const from = items.findIndex((x) => getKey(x) === dragKey); move(from, i); setDragKey(null); setOverKey(null); }}
            onDragEnd={() => { setDragKey(null); setOverKey(null); }}
          >
            {render(item, { index: i, isFirst: i === 0, isLast: i === items.length - 1, moveUp: () => move(i, i - 1), moveDown: () => move(i, i + 1), dragging: dragKey === key, over: overKey === key && dragKey !== key })}
          </li>
        );
      })}
    </ul>
  );
}

export function MoveButtons({ c, label }: { c: SortControls; label: string }) {
  return (
    <span className="inline-flex">
      <button type="button" className="px-2 py-1 text-sand-500 hover:text-black disabled:opacity-30" disabled={c.isFirst} onClick={c.moveUp} aria-label={`Move ${label} earlier`}>↑</button>
      <button type="button" className="px-2 py-1 text-sand-500 hover:text-black disabled:opacity-30" disabled={c.isLast} onClick={c.moveDown} aria-label={`Move ${label} later`}>↓</button>
    </span>
  );
}

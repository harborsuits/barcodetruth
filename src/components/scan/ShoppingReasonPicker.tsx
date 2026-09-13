import { Building2, Carrot, ShieldAlert, HeartHandshake, MapPin, Check } from 'lucide-react';
import { shoppingReasons, type ShoppingReason } from '@/lib/shoppingLens';
import { useId } from 'react';

const icons = { ownership: Building2, ingredients: Carrot, recalls: ShieldAlert, values: HeartHandshake, local: MapPin };
export function ShoppingReasonPicker({ value, onChange }: { value: ShoppingReason; onChange: (reason: ShoppingReason) => void }) {
  const groupName = useId();
  return <div className="grid grid-cols-2 sm:grid-cols-3 gap-2" role="radiogroup" aria-label="What do you want to check?">
    {shoppingReasons.map(reason => { const Icon = icons[reason.id]; const active = reason.id === value;
      return <label key={reason.id}
        className={`flex items-center gap-2 rounded-xl border px-3 py-3 text-left text-sm font-medium min-h-12 transition-colors cursor-pointer focus-within:ring-2 focus-within:ring-teal-200 ${active ? 'border-teal-300/70 bg-teal-300/10 text-teal-100' : 'border-border bg-card text-slate-300 hover:bg-muted'}`}>
        <input className="sr-only" type="radio" name={groupName} value={reason.id} checked={active} onChange={() => onChange(reason.id)} />
        <Icon className="h-4 w-4 shrink-0" aria-hidden="true" /><span className="flex-1">{reason.label}</span>{active && <Check className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />}
      </label>;
    })}
  </div>;
}

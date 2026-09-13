import { Building2, Carrot, ShieldAlert, HeartHandshake, MapPin, Check } from 'lucide-react';
import { shoppingReasons, type ShoppingReason } from '@/lib/shoppingLens';

const icons = { ownership: Building2, ingredients: Carrot, recalls: ShieldAlert, values: HeartHandshake, local: MapPin };
export function ShoppingReasonPicker({ value, onChange }: { value: ShoppingReason; onChange: (reason: ShoppingReason) => void }) {
  return <div className="grid grid-cols-2 sm:grid-cols-3 gap-2" role="group" aria-label="What matters to you?">
    {shoppingReasons.map(reason => { const Icon = icons[reason.id]; const active = reason.id === value;
      return <button type="button" key={reason.id} aria-pressed={active} onClick={() => onChange(reason.id)}
        className={`flex items-center gap-2 rounded-xl border px-3 py-3 text-left text-sm font-medium min-h-12 transition-colors ${active ? 'border-teal-300/70 bg-teal-300/10 text-teal-100' : 'border-border bg-card text-slate-300 hover:bg-muted'}`}>
        <Icon className="h-4 w-4 shrink-0" /><span className="flex-1">{reason.label}</span>{active && <Check className="h-3.5 w-3.5 shrink-0" />}
      </button>;
    })}
  </div>;
}

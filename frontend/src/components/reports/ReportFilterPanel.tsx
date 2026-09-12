import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Calendar, X, Filter } from 'lucide-react';

export interface ReportFilters {
  dateFrom?: string;
  dateTo?: string;
  status?: string;
  priority?: string;
  unit?: string;
  department?: string;
  category_id?: string;
  assigned_to?: string;
}

interface ReportFilterPanelProps {
  filters: ReportFilters;
  onChange: (filters: ReportFilters) => void;
  onApply: () => void;
  showFields?: ('date' | 'status' | 'priority' | 'unit' | 'department')[];
}

const STATUS_OPTIONS = ['Open', 'In Progress', 'Assigned', 'Resolved', 'Closed', 'Pending'];
const PRIORITY_OPTIONS = ['Low', 'Medium', 'High', 'Critical'];
const UNIT_OPTIONS = ['Corporate', 'Sri City', 'R&D'];

export function ReportFilterPanel({ filters, onChange, onApply, showFields = ['date', 'status', 'priority', 'unit'] }: ReportFilterPanelProps) {
  const [open, setOpen] = useState(true);

  const update = (key: keyof ReportFilters, value: string) => {
    onChange({ ...filters, [key]: value || undefined });
  };

  const clearAll = () => {
    onChange({});
  };

  const activeFilterCount = Object.values(filters).filter(Boolean).length;

  return (
    <div className="bg-card rounded-xl border shadow-sm">
      <button
        className="w-full flex items-center justify-between px-5 py-4 text-sm font-semibold hover:bg-muted/30 transition-colors rounded-t-xl"
        onClick={() => setOpen(o => !o)}
      >
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4" />
          Filters
          {activeFilterCount > 0 && (
            <Badge variant="default" className="text-xs h-5 px-1.5">{activeFilterCount}</Badge>
          )}
        </div>
        <span className="text-muted-foreground">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="px-5 pb-5 border-t">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mt-4">
            {showFields.includes('date') && (
              <>
                <div>
                  <label className="text-xs text-muted-foreground font-medium mb-1.5 flex items-center gap-1"><Calendar className="h-3 w-3" /> From Date</label>
                  <Input type="date" value={filters.dateFrom || ''} onChange={e => update('dateFrom', e.target.value)} className="h-9 text-sm" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground font-medium mb-1.5 flex items-center gap-1"><Calendar className="h-3 w-3" /> To Date</label>
                  <Input type="date" value={filters.dateTo || ''} onChange={e => update('dateTo', e.target.value)} className="h-9 text-sm" />
                </div>
              </>
            )}

            {showFields.includes('status') && (
              <div>
                <label className="text-xs text-muted-foreground font-medium mb-1.5 block">Status</label>
                <Select value={filters.status || ''} onValueChange={v => update('status', v === 'all' ? '' : v)}>
                  <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="All statuses" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    {STATUS_OPTIONS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}

            {showFields.includes('priority') && (
              <div>
                <label className="text-xs text-muted-foreground font-medium mb-1.5 block">Priority</label>
                <Select value={filters.priority || ''} onValueChange={v => update('priority', v === 'all' ? '' : v)}>
                  <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="All priorities" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Priorities</SelectItem>
                    {PRIORITY_OPTIONS.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}

            {showFields.includes('unit') && (
              <div>
                <label className="text-xs text-muted-foreground font-medium mb-1.5 block">Business Unit</label>
                <Select value={filters.unit || ''} onValueChange={v => update('unit', v === 'all' ? '' : v)}>
                  <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="All units" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Units</SelectItem>
                    {UNIT_OPTIONS.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          <div className="flex justify-between mt-4 pt-4 border-t">
            <Button variant="ghost" size="sm" onClick={clearAll} className="text-muted-foreground gap-1">
              <X className="h-3.5 w-3.5" /> Clear All
            </Button>
            <Button size="sm" onClick={onApply} className="gap-2">
              <Filter className="h-3.5 w-3.5" /> Apply Filters
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

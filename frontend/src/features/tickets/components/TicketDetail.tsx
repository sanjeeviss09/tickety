/**
 * TicketDetail.tsx
 * Extended to support full technician workflow:
 * Assigned -> Start Work -> In Progress -> Mark as Completed -> Awaiting Employee Confirmation
 * -> Employee Confirms/Rejects -> Resolved -> Closed (or Reopened -> repeat)
 */
import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Trash2, Loader2, Play, CheckCircle2, XCircle, RotateCcw,
  Clock, AlertTriangle, Timer, Star, Paperclip, Upload,
  Eye, EyeOff, FileText, Image as ImageIcon, Download, ChevronDown, ChevronUp,
} from 'lucide-react';
import api from '../../../lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '../../../lib/supabase';
import { useAuthStore } from '../../../store/authStore';
import { cn } from '@/lib/utils';

const STATUS_BG: Record<string, string> = {
  'Open': 'bg-blue-100 text-blue-800',
  'Assigned': 'bg-indigo-100 text-indigo-800',
  'Accepted': 'bg-violet-100 text-violet-800',
  'In Progress': 'bg-purple-100 text-purple-800',
  'Waiting for User': 'bg-yellow-100 text-yellow-800',
  'Awaiting Employee Confirmation': 'bg-orange-100 text-orange-800',
  'Reopened': 'bg-red-100 text-red-800',
  'Resolved': 'bg-green-100 text-green-800',
  'Closed': 'bg-gray-100 text-gray-700',
  'Cancelled': 'bg-red-50 text-red-600',
};

const PRIORITY_COLOR: Record<string, string> = {
  Low: 'text-slate-500', Medium: 'text-blue-600',
  High: 'text-orange-600', Critical: 'text-red-600 font-bold',
};

const ACTION_BADGE: Record<string, string> = {
  STATUS_CHANGE: 'bg-blue-100 text-blue-800 border-blue-200',
  ASSIGNMENT: 'bg-purple-100 text-purple-800 border-purple-200',
  COMMENT: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  ATTACHMENT: 'bg-cyan-100 text-cyan-800 border-cyan-200',
  WORK_STARTED: 'bg-indigo-100 text-indigo-800 border-indigo-200',
  WORK_COMPLETED: 'bg-orange-100 text-orange-800 border-orange-200',
  EMPLOYEE_CONFIRMED: 'bg-green-100 text-green-800 border-green-200',
  EMPLOYEE_REJECTED: 'bg-red-100 text-red-800 border-red-200',
  RATING_SUBMITTED: 'bg-yellow-100 text-yellow-800 border-yellow-200',
};

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${String(h).padStart(2, '0')}h ${String(m).padStart(2, '0')}m ${String(s).padStart(2, '0')}s`;
}

function WorkTimer({ workStartedAt, priorSeconds = 0 }: { workStartedAt: string; priorSeconds?: number }) {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const start = new Date(workStartedAt).getTime();
    const update = () => setElapsed(priorSeconds + Math.floor((Date.now() - start) / 1000));
    update();
    const iv = setInterval(update, 1000);
    return () => clearInterval(iv);
  }, [workStartedAt, priorSeconds]);
  return <span className="font-mono text-lg font-bold text-indigo-700">{formatDuration(elapsed)}</span>;
}

function SlaPanel({ sla }: { sla: any }) {
  if (!sla?.dueDate) return null;
  const cls = sla.status === 'Breached' ? 'border-red-300 bg-red-50 text-red-700' :
    sla.status === 'Approaching' ? 'border-orange-300 bg-orange-50 text-orange-700' : 'border-green-300 bg-green-50 text-green-700';
  return (
    <Card className={cn('border', cls.split(' ')[0], cls.split(' ')[1])}>
      <CardHeader className="pb-2">
        <CardTitle className={cn('text-sm flex items-center gap-2', cls.split(' ')[2])}>
          <Timer className="h-4 w-4" />
          SLA: <span className="font-bold">{sla.status}</span>
          {sla.isPaused && <Badge className="bg-yellow-200 text-yellow-900 text-xs ml-1">Paused</Badge>}
        </CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-2 gap-3 text-xs">
        <div><span className="text-muted-foreground block">Due</span><span className="font-semibold">{new Date(sla.dueDate).toLocaleString()}</span></div>
        <div><span className="text-muted-foreground block">Remaining</span>
          <span className={cn('font-semibold', cls.split(' ')[2])}>
            {sla.remainingSeconds < 0 ? `Overdue ${formatDuration(Math.abs(sla.remainingSeconds))}` : formatDuration(sla.remainingSeconds)}
          </span>
        </div>
        <div><span className="text-muted-foreground block">Elapsed</span><span className="font-semibold">{formatDuration(sla.elapsedSeconds)}</span></div>
        <div><span className="text-muted-foreground block">Paused</span><span className="font-semibold text-yellow-700">{formatDuration(sla.pausedSeconds)}</span></div>
      </CardContent>
    </Card>
  );
}

function StarRating({ value, onChange, readonly = false }: { value: number; onChange?: (v: number) => void; readonly?: boolean }) {
  const [hover, setHover] = useState(0);
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map(s => (
        <button key={s} type="button" onClick={() => !readonly && onChange?.(s)}
          onMouseEnter={() => !readonly && setHover(s)} onMouseLeave={() => !readonly && setHover(0)}
          className={cn('transition-all', readonly ? 'cursor-default' : 'cursor-pointer hover:scale-110')} disabled={readonly}>
          <Star className={cn('h-7 w-7 transition-colors', (hover || value) >= s ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300')} />
        </button>
      ))}
    </div>
  );
}

function ResolutionModal({ onClose, onSubmit, isSubmitting }: { onClose: () => void; onSubmit: (d: any) => Promise<void>; isSubmitting: boolean }) {
  const [form, setForm] = useState({ problem_identified: '', work_performed: '', resolution_summary: '', root_cause: '', preventive_recommendation: '' });
  const [errs, setErrs] = useState<Record<string, string>>({});
  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.problem_identified.trim()) e.problem_identified = 'Required';
    if (!form.work_performed.trim()) e.work_performed = 'Required';
    if (!form.resolution_summary.trim()) e.resolution_summary = 'Required';
    setErrs(e); return Object.keys(e).length === 0;
  };
  const fields = [
    { key: 'problem_identified', label: 'Problem Identified', req: true, ph: 'Describe the root problem...' },
    { key: 'work_performed', label: 'Work Performed', req: true, ph: 'Steps taken to fix the issue...' },
    { key: 'resolution_summary', label: 'Resolution Summary', req: true, ph: 'Summary for the employee...' },
    { key: 'root_cause', label: 'Root Cause (Optional)', req: false, ph: 'What caused this issue?' },
    { key: 'preventive_recommendation', label: 'Preventive Recommendation (Optional)', req: false, ph: 'How to prevent in future?' },
  ];
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-background rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b sticky top-0 bg-background z-10">
          <h2 className="text-xl font-bold flex items-center gap-2"><CheckCircle2 className="h-5 w-5 text-green-600" />Mark Ticket as Completed</h2>
          <p className="text-sm text-muted-foreground mt-1">Fill in the resolution details. The employee will review and confirm.</p>
        </div>
        <div className="p-6 space-y-5">
          {fields.map(({ key, label, req, ph }) => (
            <div key={key}>
              <label className="text-sm font-semibold mb-1 block">{label} {req && <span className="text-red-500">*</span>}</label>
              <textarea className={cn('w-full min-h-[90px] p-3 border rounded-lg text-sm resize-none', errs[key] ? 'border-red-400' : '')}
                placeholder={ph} value={(form as any)[key]}
                onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))} />
              {errs[key] && <p className="text-red-500 text-xs mt-0.5">{errs[key]}</p>}
            </div>
          ))}
        </div>
        <div className="p-6 border-t flex justify-end gap-3">
          <Button variant="outline" onClick={onClose} disabled={isSubmitting}>Cancel</Button>
          <Button onClick={() => validate() && onSubmit(form)} disabled={isSubmitting} className="bg-green-600 hover:bg-green-700">
            {isSubmitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Submitting...</> : <><CheckCircle2 className="mr-2 h-4 w-4" />Submit Resolution</>}
          </Button>
        </div>
      </div>
    </div>
  );
}

function EmployeeConfirmationCard({ resolutions, confirmations, onConfirm, onReject, busy }: {
  resolutions: any[]; confirmations: any[]; onConfirm: (r: number, c: string) => Promise<void>;
  onReject: (reason: string) => Promise<void>; busy: boolean;
}) {
  const [mode, setMode] = useState<'idle' | 'confirm' | 'reject'>('idle');
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [reason, setReason] = useState('');
  const [reasonErr, setReasonErr] = useState('');
  const latest = resolutions[resolutions.length - 1];
  return (
    <Card className="border-2 border-orange-300 bg-gradient-to-br from-orange-50 to-amber-50 shadow-lg">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-orange-800"><CheckCircle2 className="h-5 w-5" />Your Ticket Has Been Resolved</CardTitle>
        <CardDescription className="text-orange-700">Please review the resolution and confirm whether your issue has been fixed.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {latest && (
          <div className="bg-white rounded-lg p-4 border border-orange-200 space-y-3 text-sm">
            <div><span className="font-semibold text-xs uppercase tracking-wide text-muted-foreground">Resolution Summary</span><p className="mt-1">{latest.resolution_summary}</p></div>
            {latest.problem_identified && <div><span className="font-semibold text-xs uppercase tracking-wide text-muted-foreground">Problem Identified</span><p className="mt-1">{latest.problem_identified}</p></div>}
            {latest.work_performed && <div><span className="font-semibold text-xs uppercase tracking-wide text-muted-foreground">Work Performed</span><p className="mt-1">{latest.work_performed}</p></div>}
            <p className="text-xs text-muted-foreground">Completed on {new Date(latest.technician_completed_at).toLocaleString()}</p>
          </div>
        )}
        {mode === 'idle' && (
          <div className="flex gap-3">
            <Button className="flex-1 bg-green-600 hover:bg-green-700" onClick={() => setMode('confirm')} disabled={busy}>
              <CheckCircle2 className="mr-2 h-4 w-4" />Issue Resolved
            </Button>
            <Button variant="outline" className="flex-1 border-red-300 text-red-700 hover:bg-red-50" onClick={() => setMode('reject')} disabled={busy}>
              <XCircle className="mr-2 h-4 w-4" />Not Resolved
            </Button>
          </div>
        )}
        {mode === 'confirm' && (
          <div className="space-y-4 bg-white p-4 rounded-lg border border-green-200">
            <p className="font-semibold text-green-800">Rate the support experience:</p>
            <StarRating value={rating} onChange={setRating} />
            <textarea className="w-full min-h-[70px] p-3 border rounded-lg text-sm" placeholder="Feedback (optional)" value={comment} onChange={e => setComment(e.target.value)} />
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setMode('idle')} disabled={busy}>Back</Button>
              <Button className="flex-1 bg-green-600 hover:bg-green-700" onClick={() => onConfirm(rating, comment)} disabled={busy || rating === 0}>
                {busy ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Submitting...</> : 'Confirm & Submit Rating'}
              </Button>
            </div>
          </div>
        )}
        {mode === 'reject' && (
          <div className="space-y-4 bg-white p-4 rounded-lg border border-red-200">
            <p className="font-semibold text-red-800">What is still not working?</p>
            <textarea className={cn('w-full min-h-[90px] p-3 border rounded-lg text-sm', reasonErr ? 'border-red-400' : '')}
              placeholder="Describe the remaining issue..." value={reason}
              onChange={e => { setReason(e.target.value); setReasonErr(''); }} />
            {reasonErr && <p className="text-red-500 text-xs">{reasonErr}</p>}
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setMode('idle')} disabled={busy}>Back</Button>
              <Button className="flex-1 bg-red-600 hover:bg-red-700"
                onClick={() => { if (!reason.trim()) { setReasonErr('Please describe the issue'); return; } onReject(reason); }}
                disabled={busy}>
                {busy ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Submitting...</> : 'Report Not Resolved'}
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function AttachmentsPanel({ ticketId, canUpload }: { ticketId: string; canUpload: boolean }) {
  const [atts, setAtts] = useState<any[]>([]);
  const [showUpload, setShowUpload] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadErr, setUploadErr] = useState('');
  const [form, setForm] = useState({ description: '', attachment_type: 'evidence', visibility: 'internal' });
  const fileRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    try { const r = await api.get(`/tickets/${ticketId}/attachments`); setAtts(r.data.data ?? []); } catch {}
  };
  useEffect(() => { load(); }, [ticketId]);

  const handleUpload = async () => {
    const file = fileRef.current?.files?.[0];
    if (!file) return;
    setUploading(true); setUploadErr('');
    try {
      const path = `tickets/${ticketId}/${Date.now()}_${file.name}`;
      const { error: upErr } = await supabase.storage.from('ticket_attachments').upload(path, file, { upsert: false });
      if (upErr) throw upErr;
      await api.post(`/tickets/${ticketId}/attachments`, { file_name: file.name, file_size: file.size, file_type: file.type, storage_path: path, ...form, description: form.description || null });
      setShowUpload(false);
      if (fileRef.current) fileRef.current.value = '';
      setForm({ description: '', attachment_type: 'evidence', visibility: 'internal' });
      load();
    } catch (err: any) { setUploadErr(err.message || 'Upload failed'); }
    finally { setUploading(false); }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex justify-between items-center">
          <CardTitle className="flex items-center gap-2 text-base">
            <Paperclip className="h-4 w-4" />Attachments {atts.length > 0 && <Badge variant="secondary">{atts.length}</Badge>}
          </CardTitle>
          {canUpload && (
            <Button size="sm" variant="outline" onClick={() => setShowUpload(s => !s)}>
              <Upload className="h-4 w-4 mr-1" />{showUpload ? 'Cancel' : 'Upload'}
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {showUpload && (
          <div className="border rounded-lg p-4 space-y-3 bg-muted/30">
            <input ref={fileRef} type="file" className="w-full text-sm" />
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium block mb-1">Type</label>
                <select className="w-full p-2 border rounded text-sm" value={form.attachment_type} onChange={e => setForm(f => ({ ...f, attachment_type: e.target.value }))}>
                  <option value="evidence">Evidence</option><option value="screenshot">Screenshot</option>
                  <option value="log">Log</option><option value="document">Document</option><option value="other">Other</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-medium block mb-1">Visibility</label>
                <select className="w-full p-2 border rounded text-sm" value={form.visibility} onChange={e => setForm(f => ({ ...f, visibility: e.target.value }))}>
                  <option value="internal">Internal Only</option><option value="employee_visible">Visible to Employee</option>
                </select>
              </div>
            </div>
            <input className="w-full p-2 border rounded text-sm" placeholder="Description (optional)" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
            {uploadErr && <p className="text-red-500 text-xs">{uploadErr}</p>}
            <Button size="sm" onClick={handleUpload} disabled={uploading}>
              {uploading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Uploading...</> : 'Upload'}
            </Button>
          </div>
        )}
        {atts.length === 0 ? <p className="text-sm text-muted-foreground text-center py-3">No attachments yet</p> : (
          <div className="space-y-2">
            {atts.map((a: any) => (
              <div key={a.id} className="flex items-center gap-3 p-3 border rounded-lg hover:bg-muted/40 transition-colors">
                {a.file_type?.startsWith('image/') ? <ImageIcon className="h-4 w-4 text-blue-500 flex-shrink-0" /> : <FileText className="h-4 w-4 text-gray-500 flex-shrink-0" />}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{a.file_name}</p>
                  <p className="text-xs text-muted-foreground">{a.uploader?.full_name} · {new Date(a.created_at).toLocaleDateString()}</p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <Badge variant="outline" className="text-xs hidden sm:flex">
                    {a.visibility === 'internal' ? <><EyeOff className="h-3 w-3 mr-1" />Internal</> : <><Eye className="h-3 w-3 mr-1" />Visible</>}
                  </Badge>
                  {a.signed_url && <a href={a.signed_url} target="_blank" rel="noreferrer"><Button size="icon" variant="ghost" className="h-7 w-7"><Download className="h-3.5 w-3.5" /></Button></a>}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ResolutionHistoryPanel({ resolutions, confirmations, isEmployee }: { resolutions: any[]; confirmations: any[]; isEmployee: boolean }) {
  const [open, setOpen] = useState(true);
  if (!resolutions?.length) return null;
  return (
    <Card className="border-green-200">
      <CardHeader className="pb-3">
        <button className="flex items-center justify-between w-full" onClick={() => setOpen(o => !o)}>
          <CardTitle className="text-base flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-green-600" />
            Resolution {resolutions.length > 1 ? `(${resolutions.length} attempts)` : 'Details'}
          </CardTitle>
          {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>
      </CardHeader>
      {open && (
        <CardContent className="space-y-4">
          {resolutions.map((res: any) => {
            const conf = confirmations.find((c: any) => c.resolution_id === res.id);
            const ratingData = Array.isArray(conf?.rating) ? conf.rating[0] : conf?.rating;
            return (
              <div key={res.id} className="border rounded-lg p-4 space-y-3 bg-green-50/50">
                <div className="flex items-center justify-between">
                  <Badge variant="outline" className="bg-green-100 text-green-800">Attempt #{res.attempt_number}</Badge>
                  <span className="text-xs text-muted-foreground">{new Date(res.technician_completed_at).toLocaleString()}</span>
                </div>
                <div className="space-y-2 text-sm">
                  <div><span className="text-xs font-semibold text-muted-foreground uppercase">Resolution Summary</span><p className="mt-0.5">{res.resolution_summary}</p></div>
                  <div><span className="text-xs font-semibold text-muted-foreground uppercase">Problem Identified</span><p className="mt-0.5">{res.problem_identified}</p></div>
                  <div><span className="text-xs font-semibold text-muted-foreground uppercase">Work Performed</span><p className="mt-0.5">{res.work_performed}</p></div>
                  {!isEmployee && res.root_cause && <div><span className="text-xs font-semibold text-muted-foreground uppercase">Root Cause</span><p className="mt-0.5">{res.root_cause}</p></div>}
                  {!isEmployee && res.total_work_duration_seconds > 0 && <div><span className="text-xs font-semibold text-muted-foreground uppercase">Active Work Time</span><p className="mt-0.5 font-mono">{formatDuration(res.total_work_duration_seconds)}</p></div>}
                </div>
                {conf && (
                  <div className={cn('mt-2 p-3 rounded-md border text-sm',
                    conf.status === 'Confirmed' ? 'bg-green-50 border-green-200' : conf.status === 'Rejected' ? 'bg-red-50 border-red-200' : 'bg-yellow-50 border-yellow-200')}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-semibold">Employee {conf.status}</span>
                      {conf.responded_at && <span className="text-xs text-muted-foreground">{new Date(conf.responded_at).toLocaleString()}</span>}
                    </div>
                    {conf.rejection_reason && <p className="text-xs text-red-700">Reason: {conf.rejection_reason}</p>}
                    {ratingData && (
                      <div className="flex items-center gap-2 mt-2">
                        <StarRating value={ratingData.rating} readonly />
                        {ratingData.feedback_comment && <span className="text-xs text-muted-foreground">"{ratingData.feedback_comment}"</span>}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </CardContent>
      )}
    </Card>
  );
}

export function TicketDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [ticket, setTicket] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [comments, setComments] = useState<any[]>([]);
  const [timeline, setTimeline] = useState<any[]>([]);
  const [sessionData, setSessionData] = useState<any>(null);
  const [unitTechnicians, setUnitTechnicians] = useState<any[]>([]);
  const [commentText, setCommentText] = useState('');
  const [isInternal, setIsInternal] = useState(false);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [isPostingComment, setIsPostingComment] = useState(false);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState('');
  const [workSummary, setWorkSummary] = useState<any>(null);
  const [resolutionData, setResolutionData] = useState<any>({ resolutions: [], confirmations: [] });
  const [showResolutionModal, setShowResolutionModal] = useState(false);
  const { profile } = useAuthStore();

  const role = profile?.roles?.name;
  const isAdminOrTech = role === 'Admin' || role === 'Technician';
  const isTech = role === 'Technician';
  const isEmployee = role === 'Employee';
  const isAdmin = role === 'Admin';
  const isAssignedTech = isTech && ticket?.assigned_to === profile?.id;

  const reload = async () => {
    try {
      const [t, c, tl] = await Promise.all([api.get(`/tickets/${id}`), api.get(`/tickets/${id}/comments`), api.get(`/tickets/${id}/timeline`)]);
      setTicket(t.data.data); setComments(c.data.data ?? []); setTimeline(tl.data.data ?? []);
      api.get(`/tickets/${id}/work-summary`).then(r => setWorkSummary(r.data.data)).catch(() => {});
      api.get(`/tickets/${id}/resolution`).then(r => setResolutionData(r.data.data)).catch(() => {});
    } catch (err: any) { setError(err.response?.data?.message || err.message); }
  };

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      try {
        const [t, c, tl] = await Promise.all([api.get(`/tickets/${id}`), api.get(`/tickets/${id}/comments`), api.get(`/tickets/${id}/timeline`)]);
        const tick = t.data.data;
        setTicket(tick); setComments(c.data.data ?? []); setTimeline(tl.data.data ?? []);
        if (tick.self_service_session_id) supabase.from('self_service_sessions').select('*, interactions:self_service_interactions(*, article:knowledge_articles(title, slug))').eq('id', tick.self_service_session_id).single().then(({ data }) => setSessionData(data));
        if (tick.unit_id && (role === 'Admin' || role === 'Technician')) api.get('/employees').then(r => setUnitTechnicians(r.data.data?.filter((e: any) => e.role?.name === 'Technician' && e.unit_id === tick.unit_id) ?? [])).catch(() => {});
        api.get(`/tickets/${id}/work-summary`).then(r => setWorkSummary(r.data.data)).catch(() => {});
        api.get(`/tickets/${id}/resolution`).then(r => setResolutionData(r.data.data)).catch(() => {});
      } catch (err: any) { setError(err.response?.data?.message || err.message); }
      finally { setLoading(false); }
    };
    if (id) init();
  }, [id, role]);

  const withBusy = async (fn: () => Promise<void>) => {
    if (busy) return; setBusy(true); setActionError('');
    try { await fn(); await reload(); }
    catch (err: any) { setActionError(err.response?.data?.message || err.message || 'Action failed'); throw err; }
    finally { setBusy(false); }
  };

  const handleStartWork = () => withBusy(() => api.post(`/tickets/${id}/start-work`).then(() => {}));
  const handleMarkCompleted = async (form: any) => {
    await withBusy(async () => { await api.post(`/tickets/${id}/complete`, form); setShowResolutionModal(false); });
  };
  const handleConfirm = (rating: number, comment: string) =>
    withBusy(() => api.post(`/tickets/${id}/confirm-resolution`, { confirmed: true, rating, feedback_comment: comment || null }).then(() => {}));
  const handleReject = (reason: string) =>
    withBusy(() => api.post(`/tickets/${id}/confirm-resolution`, { confirmed: false, rejection_reason: reason }).then(() => {}));

  if (loading) return <div className="flex items-center justify-center p-16"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  if (error) return <div className="p-8 text-center text-destructive">{error}</div>;
  if (!ticket) return <div className="p-8 text-center">Ticket not found</div>;

  const { status } = ticket;
  const isClosed = ['Closed', 'Cancelled', 'Resolved'].includes(status);

  return (
    <div className="space-y-6">
      {showResolutionModal && <ResolutionModal onClose={() => setShowResolutionModal(false)} onSubmit={handleMarkCompleted} isSubmitting={busy} />}

      <div className="flex justify-between items-start gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <Badge className={cn('text-xs font-semibold px-2.5 py-1', STATUS_BG[status] || 'bg-gray-100 text-gray-700')}>{status}</Badge>
            <span className={cn('text-sm font-semibold', PRIORITY_COLOR[ticket.priority])}>{ticket.priority} Priority</span>
            {ticket.reopen_count > 0 && <Badge variant="outline" className="text-orange-700 border-orange-300 text-xs"><RotateCcw className="h-3 w-3 mr-1" />Reopened {ticket.reopen_count}x</Badge>}
          </div>
          <h1 className="text-2xl font-bold tracking-tight">{ticket.ticket_number}: {ticket.subject}</h1>
          <p className="text-muted-foreground text-sm mt-1">Submitted by {ticket.creator?.full_name} on {new Date(ticket.created_at).toLocaleString()}</p>
        </div>
        <Button variant="outline" onClick={() => navigate(-1)}>Back</Button>
      </div>

      {actionError && (
        <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          <AlertTriangle className="h-4 w-4 flex-shrink-0" />{actionError}
          <button className="ml-auto text-xs underline" onClick={() => setActionError('')}>Dismiss</button>
        </div>
      )}

      {isAssignedTech && (
        <Card className="border-2 border-indigo-200 bg-gradient-to-br from-indigo-50 to-blue-50">
          <CardContent className="p-4 flex items-center justify-between gap-4 flex-wrap">
            <div>
              <p className="text-sm font-semibold text-indigo-900">Technician Actions</p>
              {status === 'In Progress' && ticket.work_started_at && (
                <div className="flex items-center gap-2 mt-1"><Clock className="h-4 w-4 text-indigo-600" />
                  <span className="text-xs text-muted-foreground">Session:</span>
                  <WorkTimer workStartedAt={ticket.work_started_at} priorSeconds={workSummary?.metrics?.totalWorkDurationSeconds || 0} />
                </div>
              )}
              {status === 'Awaiting Employee Confirmation' && <p className="text-sm text-orange-700 mt-1">Waiting for employee to confirm resolution.</p>}
            </div>
            <div className="flex gap-3">
              {status === 'Assigned' && (
                <Button id="btn-start-work" onClick={handleStartWork} disabled={busy} className="bg-indigo-600 hover:bg-indigo-700" size="lg">
                  {busy ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Starting...</> : <><Play className="mr-2 h-5 w-5" />Start Work</>}
                </Button>
              )}
              {status === 'Reopened' && (
                <Button id="btn-resume-work" onClick={handleStartWork} disabled={busy} className="bg-orange-600 hover:bg-orange-700">
                  {busy ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Resuming...</> : <><RotateCcw className="mr-2 h-4 w-4" />Resume Work</>}
                </Button>
              )}
              {status === 'In Progress' && (
                <Button id="btn-mark-completed" onClick={() => setShowResolutionModal(true)} disabled={busy} className="bg-green-600 hover:bg-green-700">
                  <CheckCircle2 className="mr-2 h-4 w-4" />Mark as Completed
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {isEmployee && status === 'Awaiting Employee Confirmation' && (
        <EmployeeConfirmationCard resolutions={resolutionData?.resolutions ?? []} confirmations={resolutionData?.confirmations ?? []}
          onConfirm={handleConfirm} onReject={handleReject} busy={busy} />
      )}

      {isAdminOrTech && !isClosed && workSummary?.slaStatus && <SlaPanel sla={workSummary.slaStatus} />}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-6">
          <Card>
            <CardHeader><CardTitle>Description</CardTitle></CardHeader>
            <CardContent><p className="whitespace-pre-wrap text-sm leading-relaxed">{ticket.description}</p></CardContent>
          </Card>

          {sessionData && (
            <Card className="border-blue-200 bg-blue-50/50">
              <CardHeader className="pb-3">
                <CardTitle className="text-blue-900 text-lg flex items-center gap-2"><span className="bg-blue-100 p-1.5 rounded-md">🧠</span> Troubleshooting Already Attempted</CardTitle>
                <CardDescription className="text-blue-800/80">Knowledge articles viewed before raising this ticket.</CardDescription>
              </CardHeader>
              <CardContent>
                {sessionData.interactions?.length > 0 ? (
                  <ul className="space-y-2">{sessionData.interactions.map((i: any) => (
                    <li key={i.id} className="text-sm bg-white border border-blue-100 p-3 rounded-md flex items-center gap-2 shadow-sm">
                      <span className="text-muted-foreground flex-shrink-0">Reviewed:</span>
                      <a href={`/help-center/article/${i.article?.slug}`} target="_blank" rel="noreferrer" className="font-medium text-blue-700 hover:underline">{i.article?.title || 'Unknown'}</a>
                    </li>
                  ))}</ul>
                ) : <p className="text-sm text-muted-foreground italic">No articles viewed.</p>}
              </CardContent>
            </Card>
          )}

          {resolutionData?.resolutions?.length > 0 && (
            <ResolutionHistoryPanel resolutions={resolutionData.resolutions} confirmations={resolutionData.confirmations} isEmployee={isEmployee} />
          )}

          <AttachmentsPanel ticketId={id!} canUpload={(isAssignedTech || isAdmin) && !isClosed} />

          <Card>
            <CardHeader><CardTitle>Timeline & Activity</CardTitle><CardDescription>All actions, updates, and notes</CardDescription></CardHeader>
            <CardContent className="space-y-6">
              {(() => {
                const clean = timeline.filter((e, i, a) => {
                  if (e.metadata?.old_status === e.metadata?.new_status) return false;
                  if (e.message?.match(/Status changed from (.*) to \1/i)) return false;
                  if (i > 0) { const p = a[i-1]; if (p.message === e.message && p.user_id === e.user_id && Math.abs(new Date(e.created_at).getTime() - new Date(p.created_at).getTime()) < 15000) return false; }
                  return true;
                });
                if (!clean.length) return <p className="text-sm text-muted-foreground text-center py-4">No activity yet.</p>;
                return (
                  <div className="relative pl-6 space-y-4 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-muted-foreground/20">
                    {clean.map(ev => (
                      <div key={ev.id} className="relative flex items-start gap-3 text-sm">
                        <div className="absolute -left-6 top-1 h-3 w-3 rounded-full border-2 border-primary bg-background shadow-sm" />
                        <div className="flex-1 bg-muted/40 p-3 rounded-lg border">
                          <div className="flex items-center justify-between gap-2 mb-1">
                            <span className="font-semibold">{ev.user?.full_name || 'System'}</span>
                            <span className={cn('text-[11px] font-medium px-2 py-0.5 rounded border', ACTION_BADGE[ev.action_type] || 'bg-slate-100 text-slate-700 border-slate-200')}>
                              {ev.action_type.replace(/_/g, ' ')}
                            </span>
                          </div>
                          <p className="text-muted-foreground text-xs">{ev.message}</p>
                          <span className="text-[10px] text-muted-foreground block mt-1.5">{new Date(ev.created_at).toLocaleString()}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })()}
              {comments.length > 0 && (
                <div className="space-y-3 mt-4">
                  {comments.map((c) => (
                    <div key={c.id} className={cn('p-4 rounded-lg border', c.is_internal ? 'bg-yellow-50 border-yellow-200' : 'bg-card')}>
                      <div className="flex justify-between items-center mb-2">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-sm">{c.author?.full_name}</span>
                          {c.is_internal && <Badge variant="secondary" className="text-xs bg-yellow-200 text-yellow-800">Internal</Badge>}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">{new Date(c.created_at).toLocaleString()}</span>
                          {(c.author_id === profile?.id || isAdmin) && (
                            <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={async () => {
                              try { await api.delete(`/tickets/${id}/comments/${c.id}`); const [cr, tl] = await Promise.all([api.get(`/tickets/${id}/comments`), api.get(`/tickets/${id}/timeline`)]); setComments(cr.data.data); setTimeline(tl.data.data); } catch {}
                            }}><Trash2 className="h-4 w-4" /></Button>
                          )}
                        </div>
                      </div>
                      <p className="text-sm whitespace-pre-wrap">{c.content}</p>
                    </div>
                  ))}
                </div>
              )}
              {!isClosed && (
                <div className="space-y-3 mt-4 pt-4 border-t">
                  <textarea className="w-full min-h-[90px] p-3 border rounded-lg text-sm resize-none" placeholder="Add a comment..." value={commentText} onChange={e => setCommentText(e.target.value)} />
                  <div className="flex items-center justify-between">
                    {isAdminOrTech && (
                      <label className="flex items-center gap-2 text-sm cursor-pointer">
                        <input type="checkbox" checked={isInternal} onChange={e => setIsInternal(e.target.checked)} className="rounded" />
                        <span>Internal Note <span className="text-xs text-muted-foreground">(Hidden from Employee)</span></span>
                      </label>
                    )}
                    <Button disabled={isPostingComment || !commentText.trim()} onClick={async () => {
                      if (!commentText.trim() || isPostingComment) return;
                      setIsPostingComment(true);
                      try { await api.post(`/tickets/${id}/comments`, { content: commentText, is_internal: isInternal }); setCommentText(''); const [cr, tl] = await Promise.all([api.get(`/tickets/${id}/comments`), api.get(`/tickets/${id}/timeline`)]); setComments(cr.data.data); setTimeline(tl.data.data); }
                      catch {} finally { setIsPostingComment(false); }
                    }}>
                      {isPostingComment ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Posting...</> : 'Post Comment'}
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Ticket Details</CardTitle></CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div>
                <span className="text-muted-foreground block mb-1">Status</span>
                {isAdminOrTech ? (
                  <select className="w-full p-2 border rounded text-sm font-medium" value={status} disabled={isUpdatingStatus}
                    onChange={async e => {
                      const s = e.target.value; if (s === status || isUpdatingStatus) return;
                      setIsUpdatingStatus(true);
                      try { await api.patch(`/tickets/${id}/status`, { status: s }); await reload(); }
                      catch {} finally { setIsUpdatingStatus(false); }
                    }}>
                    {['Open','Assigned','In Progress','Waiting for User','Awaiting Employee Confirmation','Resolved','Closed','Reopened','Cancelled'].map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                ) : <Badge className={cn('text-xs', STATUS_BG[status] || 'bg-gray-100 text-gray-700')}>{status}</Badge>}
              </div>
              <div><span className="text-muted-foreground block mb-1">Priority</span><span className={cn('font-semibold', PRIORITY_COLOR[ticket.priority])}>{ticket.priority}</span></div>
              <div><span className="text-muted-foreground block mb-1">Category</span><span className="font-medium">{ticket.ticket_categories?.name || 'N/A'}</span></div>
              {ticket.units?.name && <div><span className="text-muted-foreground block mb-1">Unit</span><span className="font-medium">{ticket.units.name}</span></div>}
              {ticket.departments?.name && <div><span className="text-muted-foreground block mb-1">Department</span><span className="font-medium">{ticket.departments.name}</span></div>}
              {ticket.assets?.length > 0 && (
                <div><span className="text-muted-foreground block mb-1">Related Asset</span>
                  <button className="font-medium text-blue-600 hover:underline" onClick={() => navigate(`/assets/${ticket.assets[0].asset.id}`)}>{ticket.assets[0].asset.name} ({ticket.assets[0].asset.asset_code})</button>
                </div>
              )}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-muted-foreground">Assignee</span>
                  {isAdmin && <Button variant="ghost" size="sm" className="h-5 text-xs px-1" onClick={async () => { try { await api.post(`/tickets/${id}/assign`, { assigned_to: profile?.id }); await reload(); } catch {} }}>Assign to Me</Button>}
                </div>
                {isAdmin ? (
                  <select className="w-full p-2 border rounded text-sm font-medium" value={ticket.assigned_to || ''} disabled={isUpdatingStatus}
                    onChange={async e => {
                      const v = e.target.value || null; if (v === (ticket.assigned_to || null) || isUpdatingStatus) return;
                      setIsUpdatingStatus(true);
                      try { await api.post(`/tickets/${id}/assign`, { assigned_to: v }); await reload(); }
                      catch {} finally { setIsUpdatingStatus(false); }
                    }}>
                    <option value="">Unassigned</option>
                    {unitTechnicians.map((t: any) => <option key={t.id} value={t.id}>{t.full_name}</option>)}
                    {ticket.assignee && !unitTechnicians.find((t: any) => t.id === ticket.assigned_to) && <option value={ticket.assigned_to}>{ticket.assignee.full_name} (Other)</option>}
                  </select>
                ) : <span className="font-medium">{ticket.assignee?.full_name || 'Unassigned'}</span>}
              </div>
              <div><span className="text-muted-foreground block mb-1">SLA Due</span>
                <span className={cn('font-medium', ticket.due_date && new Date(ticket.due_date) < new Date() && !isClosed ? 'text-red-600' : '')}>
                  {ticket.due_date ? new Date(ticket.due_date).toLocaleString() : 'N/A'}
                </span>
              </div>
              {ticket.work_started_at && <div><span className="text-muted-foreground block mb-1">Work Started</span><span className="font-medium">{new Date(ticket.work_started_at).toLocaleString()}</span></div>}
              {ticket.technician_completed_at && <div><span className="text-muted-foreground block mb-1">Tech Completed</span><span className="font-medium">{new Date(ticket.technician_completed_at).toLocaleString()}</span></div>}
              {ticket.employee_confirmed_at && <div><span className="text-muted-foreground block mb-1">Employee Confirmed</span><span className="font-medium text-green-700">{new Date(ticket.employee_confirmed_at).toLocaleString()}</span></div>}
              {ticket.closed_at && <div><span className="text-muted-foreground block mb-1">Closed At</span><span className="font-medium">{new Date(ticket.closed_at).toLocaleString()}</span></div>}
              {isAdminOrTech && workSummary?.metrics?.totalWorkDurationSeconds > 0 && (
                <div><span className="text-muted-foreground block mb-1">Total Work Time</span><span className="font-mono font-semibold">{formatDuration(workSummary.metrics.totalWorkDurationSeconds)}</span></div>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Submitted By</CardTitle></CardHeader>
            <CardContent className="text-sm">
              <p className="font-semibold">{ticket.creator?.full_name}</p>
              <p className="text-muted-foreground text-xs">{ticket.creator?.email_address}</p>
              {ticket.creator?.employee_id && <p className="text-muted-foreground text-xs">ID: {ticket.creator.employee_id}</p>}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

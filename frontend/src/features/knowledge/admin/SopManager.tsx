import { useState, useEffect } from 'react';
import { useKnowledgeStore } from '../../../store/knowledgeStore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Edit, Trash2, FileText, Download } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { supabase } from '../../../lib/supabase';
import { Badge } from '@/components/ui/badge';

export function SopManager() {
  const { sops, fetchSops, createSop, updateSop, deleteSop } = useKnowledgeStore();
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [formData, setFormData] = useState({ title: '', description: '', department_id: '', status: 'Draft', storage_path: '' });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [departments, setDepartments] = useState<any[]>([]);

  useEffect(() => {
    fetchSops();
    fetchDepartments();
  }, [fetchSops]);

  const fetchDepartments = async () => {
    const { data } = await supabase.from('departments').select('id, name');
    if (data) setDepartments(data);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      let storage_path = formData.storage_path;

      if (file) {
        const fileExt = file.name.split('.').pop();
        const fileName = `${Math.random()}.${fileExt}`;
        const filePath = `sops/${fileName}`;

        const { error: uploadError } = await supabase.storage.from('sop_documents').upload(filePath, file);
        if (uploadError) throw uploadError;
        storage_path = filePath;
      }

      const payload = { ...formData, storage_path };

      if (editingId) {
        await updateSop(editingId, payload);
      } else {
        await createSop(payload);
      }
      setIsOpen(false);
      resetForm();
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string, path: string) => {
    if (!confirm('Are you sure you want to delete this SOP?')) return;
    try {
      await deleteSop(id);
      if (path) {
        await supabase.storage.from('sop_documents').remove([path]);
      }
    } catch (error) {
      console.error(error);
    }
  };

  const resetForm = () => {
    setFormData({ title: '', description: '', department_id: '', status: 'Draft', storage_path: '' });
    setEditingId(null);
    setFile(null);
  };

  const openEdit = (sop: any) => {
    setFormData({ title: sop.title, description: sop.description, department_id: sop.department_id || '', status: sop.status, storage_path: sop.storage_path });
    setEditingId(sop.id);
    setFile(null);
    setIsOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold tracking-tight">SOP Manager</h2>
        <Dialog open={isOpen} onOpenChange={(open) => { setIsOpen(open); if (!open) resetForm(); }}>
          <DialogTrigger asChild>
            <Button><Plus className="mr-2 h-4 w-4" /> New SOP</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{editingId ? 'Edit SOP' : 'Upload SOP'}</DialogTitle></DialogHeader>
            <form onSubmit={handleSave} className="space-y-4">
              <div className="space-y-2">
                <Label>Title</Label>
                <Input required value={formData.title} onChange={e => setFormData({ ...formData, title: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Department (Optional)</Label>
                  <Select value={formData.department_id} onValueChange={(val) => setFormData({ ...formData, department_id: val })}>
                    <SelectTrigger><SelectValue placeholder="All Departments" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">All Departments</SelectItem>
                      {departments.map(d => (
                        <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select value={formData.status} onValueChange={(val) => setFormData({ ...formData, status: val })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Draft">Draft</SelectItem>
                      <SelectItem value="Active">Active</SelectItem>
                      <SelectItem value="Expired">Expired</SelectItem>
                      <SelectItem value="Retired">Retired</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Document File</Label>
                <Input type="file" onChange={e => setFile(e.target.files?.[0] || null)} required={!editingId} />
                {editingId && formData.storage_path && <p className="text-xs text-muted-foreground">Leave empty to keep existing file: {formData.storage_path}</p>}
              </div>
              <Button type="submit" disabled={loading} className="w-full">Save SOP</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="rounded-md border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 text-left font-medium">Title</th>
                  <th className="px-4 py-3 text-left font-medium">Department</th>
                  <th className="px-4 py-3 text-left font-medium">Status</th>
                  <th className="px-4 py-3 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {sops.map((sop) => (
                  <tr key={sop.id} className="hover:bg-muted/50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <p className="font-medium">{sop.title}</p>
                          <p className="text-xs text-muted-foreground line-clamp-1">{sop.description}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">{sop.departments?.name || 'All'}</td>
                    <td className="px-4 py-3">
                      <Badge variant={sop.status === 'Active' ? 'default' : 'secondary'}>{sop.status}</Badge>
                    </td>
                    <td className="px-4 py-3 text-right space-x-1">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(sop)}>
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(sop.id, sop.storage_path)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </td>
                  </tr>
                ))}
                {sops.length === 0 && (
                  <tr><td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">No SOPs found.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

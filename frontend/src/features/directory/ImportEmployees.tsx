import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import * as XLSX from 'xlsx';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../lib/api';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ArrowLeft, Download, Upload, AlertCircle, CheckCircle2 } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

export function ImportEmployees() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [file, setFile] = useState<File | null>(null);
  const [previewData, setPreviewData] = useState<any[]>([]);
  const [importResult, setImportResult] = useState<any>(null);
  
  const downloadTemplate = () => {
    const ws = XLSX.utils.json_to_sheet([
      {
        employee_id: 'EMP-001',
        full_name: 'John Doe',
        email: 'john@example.com',
        mobile: '1234567890',
        designation: 'Software Engineer',
        employment_status: 'Active'
      }
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Template');
    XLSX.writeFile(wb, 'Employee_Import_Template.xlsx');
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const uploadedFile = e.target.files?.[0];
    if (!uploadedFile) return;
    
    setFile(uploadedFile);
    
    const reader = new FileReader();
    reader.onload = (evt) => {
      const bstr = evt.target?.result;
      const wb = XLSX.read(bstr, { type: 'binary' });
      const wsname = wb.SheetNames[0];
      const ws = wb.Sheets[wsname];
      const data = XLSX.utils.sheet_to_json(ws);
      setPreviewData(data);
      setImportResult(null);
    };
    reader.readAsBinaryString(uploadedFile);
  };

  const importMutation = useMutation({
    mutationFn: async () => {
      if (!file || previewData.length === 0) throw new Error('No data to import');
      const payload = {
        file_name: file.name,
        records: previewData
      };
      const res = await api.post('/employees/bulk-import', payload);
      return res.data.data;
    },
    onSuccess: (data) => {
      setImportResult(data);
      queryClient.invalidateQueries({ queryKey: ['employees'] });
    },
    onError: (err: any) => {
      console.error(err);
      alert('Import failed: ' + (err.response?.data?.message || err.message));
    }
  });

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex items-center space-x-4">
        <Button variant="ghost" asChild>
          <Link to="/directory">
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to Directory
          </Link>
        </Button>
        <h1 className="text-3xl font-bold tracking-tight">Bulk Import Employees</h1>
      </div>

      {!importResult ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="md:col-span-1 h-fit">
            <CardHeader>
              <CardTitle>1. Download Template</CardTitle>
              <CardDescription>Use the standard template to ensure correct formatting.</CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={downloadTemplate} className="w-full">
                <Download className="mr-2 h-4 w-4" /> Download Template
              </Button>
            </CardContent>

            <CardHeader className="border-t">
              <CardTitle>2. Upload File</CardTitle>
              <CardDescription>Upload your completed Excel or CSV file.</CardDescription>
            </CardHeader>
            <CardContent>
              <Input type="file" accept=".xlsx, .xls, .csv" onChange={handleFileUpload} />
              
              {previewData.length > 0 && (
                <Button 
                  className="w-full mt-4" 
                  onClick={() => importMutation.mutate()}
                  disabled={importMutation.isPending}
                >
                  {importMutation.isPending ? 'Importing...' : 'Confirm & Import'}
                </Button>
              )}
            </CardContent>
          </Card>

          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle>Import Preview</CardTitle>
              <CardDescription>
                {previewData.length > 0 
                  ? `Found ${previewData.length} records to import.` 
                  : 'Upload a file to see preview.'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {previewData.length > 0 ? (
                <div className="rounded-md border overflow-x-auto max-h-[500px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Emp ID</TableHead>
                        <TableHead>Name</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Designation</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {previewData.slice(0, 10).map((row, i) => (
                        <TableRow key={i}>
                          <TableCell>{row.employee_id}</TableCell>
                          <TableCell>{row.full_name}</TableCell>
                          <TableCell>{row.email}</TableCell>
                          <TableCell>{row.designation}</TableCell>
                          <TableCell>{row.employment_status}</TableCell>
                        </TableRow>
                      ))}
                      {previewData.length > 10 && (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center text-muted-foreground">
                            ... and {previewData.length - 10} more rows
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground border-2 border-dashed rounded-lg">
                  <Upload className="h-8 w-8 mb-2" />
                  <p>No data to preview</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Import Results</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 border rounded-lg text-center">
                <div className="text-2xl font-bold">{importResult.successful + importResult.failed}</div>
                <div className="text-sm text-muted-foreground">Total Processed</div>
              </div>
              <div className="p-4 border rounded-lg text-center bg-green-50 dark:bg-green-900/20">
                <div className="text-2xl font-bold text-green-600 dark:text-green-400">{importResult.successful}</div>
                <div className="text-sm text-green-600 dark:text-green-400">Successful</div>
              </div>
              <div className="p-4 border rounded-lg text-center bg-destructive/10">
                <div className="text-2xl font-bold text-destructive">{importResult.failed}</div>
                <div className="text-sm text-destructive">Failed</div>
              </div>
            </div>

            {importResult.errors && importResult.errors.length > 0 && (
              <div className="space-y-4">
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Errors Occurred</AlertTitle>
                  <AlertDescription>
                    Some records could not be imported. Please review the errors below.
                  </AlertDescription>
                </Alert>
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Row</TableHead>
                        <TableHead>Error Message</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {importResult.errors.map((err: any, i: number) => (
                        <TableRow key={i}>
                          <TableCell className="font-medium">{err.row_number}</TableCell>
                          <TableCell className="text-destructive">{err.error_message}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}

            <div className="flex justify-end pt-4">
              <Button asChild>
                <Link to="/directory">Return to Directory</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

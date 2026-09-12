import { useRef } from 'react';
import { useReactToPrint } from 'react-to-print';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuTrigger, DropdownMenuSeparator
} from '@/components/ui/dropdown-menu';
import { Download, Printer } from 'lucide-react';

interface ExportToolbarProps {
  data: any[];
  columns: { key: string; label: string }[];
  filename?: string;
  reportTitle?: string;
  printRef?: React.RefObject<HTMLDivElement | null>;
}

export function ExportToolbar({ data, columns, filename = 'report', reportTitle = 'Report', printRef }: ExportToolbarProps) {
  const localPrintRef = useRef<HTMLDivElement>(null);
  const resolvedPrintRef = printRef || localPrintRef;

  const handlePrint = useReactToPrint({ contentRef: resolvedPrintRef });

  const exportCSV = () => {
    const header = columns.map(c => c.label).join(',');
    const rows = data.map(row =>
      columns.map(c => {
        const val = row[c.key] ?? '';
        const str = typeof val === 'object' ? JSON.stringify(val) : String(val);
        return `"${str.replace(/"/g, '""')}"`;
      }).join(',')
    );
    const csv = [header, ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${filename}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const exportExcel = () => {
    const wsData = [
      columns.map(c => c.label),
      ...data.map(row => columns.map(c => row[c.key] ?? ''))
    ];
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Report');
    XLSX.writeFile(wb, `${filename}.xlsx`);
  };

  const exportPDF = () => {
    const doc = new jsPDF({ orientation: 'landscape' });
    const now = new Date().toLocaleString();

    // Header
    doc.setFontSize(16);
    doc.setTextColor(30, 30, 30);
    doc.text('DeskPulse Enterprise', 14, 15);
    doc.setFontSize(12);
    doc.text(reportTitle, 14, 23);
    doc.setFontSize(9);
    doc.setTextColor(100);
    doc.text(`Generated: ${now}`, 14, 30);

    autoTable(doc, {
      startY: 35,
      head: [columns.map(c => c.label)],
      body: data.map(row => columns.map(c => {
        const val = row[c.key] ?? '';
        return typeof val === 'object' ? JSON.stringify(val) : String(val);
      })),
      styles: { fontSize: 8, cellPadding: 3 },
      headStyles: { fillColor: [99, 102, 241], textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      margin: { top: 35, left: 14, right: 14 },
      didDrawPage: (data) => {
        // Footer with page number
        const pageCount = (doc as any).internal.getNumberOfPages();
        doc.setFontSize(8);
        doc.setTextColor(150);
        doc.text(`Page ${data.pageNumber} of ${pageCount}`, doc.internal.pageSize.width - 30, doc.internal.pageSize.height - 10);
      }
    });

    doc.save(`${filename}.pdf`);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Download className="h-4 w-4" />
          Export
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={exportCSV}>
          📄 Export as CSV
        </DropdownMenuItem>
        <DropdownMenuItem onClick={exportExcel}>
          📊 Export as Excel (.xlsx)
        </DropdownMenuItem>
        <DropdownMenuItem onClick={exportPDF}>
          🖨 Export as PDF
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => handlePrint()}>
          <Printer className="h-4 w-4 mr-2" /> Print Report
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

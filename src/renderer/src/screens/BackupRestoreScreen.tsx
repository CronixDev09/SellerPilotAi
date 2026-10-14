import React, { useState, useEffect } from 'react';
import {
  HardDrive,
  Download,
  Upload,
  CheckCircle2,
  AlertTriangle,
  History,
  ShieldCheck,
  FileSpreadsheet,
  FolderOpen,
  RefreshCw,
} from 'lucide-react';
import { BackupRecord } from '../../../shared/types';
import { formatDateTime } from '../utils/formatters';

interface BackupRestoreScreenProps {
  onNotify: (msg: string, type?: 'success' | 'error' | 'info') => void;
  onRefreshAll: () => void;
}

export const BackupRestoreScreen: React.FC<BackupRestoreScreenProps> = ({
  onNotify,
  onRefreshAll,
}) => {
  const [history, setHistory] = useState<BackupRecord[]>([]);
  const [dbInfo, setDbInfo] = useState<{
    dbPath: string;
    sizeBytes: number;
    integrityOk: boolean;
  } | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const loadData = async () => {
    try {
      const [h, info] = await Promise.all([
        window.sellerPilot.getBackupHistory(),
        window.sellerPilot.getDbInfo(),
      ]);
      setHistory(h);
      setDbInfo(info);
    } catch (err: any) {
      onNotify('Failed to fetch backup history', 'error');
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreateBackup = async () => {
    try {
      setIsProcessing(true);
      const res = await window.sellerPilot.createBackup();
      onNotify(`Backup created successfully: ${res.filename} (${(res.size / 1024).toFixed(1)} KB)`, 'success');
      loadData();
    } catch (err: any) {
      onNotify(err.message || 'Backup creation failed', 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRestoreBackup = async () => {
    try {
      const fileRes = await window.sellerPilot.openFileDialog({
        filters: [{ name: 'SQLite Database', extensions: ['db', 'sqlite'] }],
      });
      if (!fileRes) return;

      const confirmed = confirm(
        `Are you sure you want to restore from "${fileRes.filePath}"?\n\nA safety recovery backup of your current database will be created automatically before restoring.`
      );
      if (!confirmed) return;

      setIsProcessing(true);
      await window.sellerPilot.restoreBackup(fileRes.filePath);
      onNotify('Database restored and verified successfully!', 'success');
      loadData();
      onRefreshAll();
    } catch (err: any) {
      onNotify(err.message || 'Restore failed', 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleExportProductsCsv = async () => {
    try {
      const csv = await window.sellerPilot.exportProductsCsv();
      const saved = await window.sellerPilot.saveFileDialog({
        defaultName: `sellerpilot_products_backup_${new Date().toISOString().slice(0, 10)}.csv`,
        content: csv,
        filters: [{ name: 'CSV File', extensions: ['csv'] }],
      });
      if (saved) onNotify(`Exported products to ${saved}`, 'success');
    } catch (err: any) {
      onNotify('Export failed', 'error');
    }
  };

  const handleExportSalesCsv = async () => {
    try {
      const csv = await window.sellerPilot.exportSalesCsv();
      const saved = await window.sellerPilot.saveFileDialog({
        defaultName: `sellerpilot_sales_backup_${new Date().toISOString().slice(0, 10)}.csv`,
        content: csv,
        filters: [{ name: 'CSV File', extensions: ['csv'] }],
      });
      if (saved) onNotify(`Exported sales to ${saved}`, 'success');
    } catch (err: any) {
      onNotify('Export failed', 'error');
    }
  };

  return (
    <div className="space-y-6 pb-12">
      <div>
        <h2 className="text-xl font-bold text-slate-800">Backup & Restore</h2>
        <p className="text-xs text-slate-500 mt-0.5">
          Protect your business records locally. Never rely on a single disk alone.
        </p>
      </div>

      {/* Database Status Card */}
      {dbInfo && (
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-sm text-slate-900">Active SQLite Database</h3>
                <p className="text-xs text-slate-500 font-mono mt-0.5 break-all">{dbInfo.dbPath}</p>
              </div>
            </div>
            <div className="text-right">
              <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800">
                Integrity OK
              </span>
              <p className="text-[11px] text-slate-400 mt-1">
                {(dbInfo.sizeBytes / 1024).toFixed(1)} KB on disk
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Action Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Create Backup */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm flex flex-col justify-between space-y-4">
          <div>
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center mb-3">
              <HardDrive className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-sm text-slate-900">Create Full Database Backup</h3>
            <p className="text-xs text-slate-500 mt-1">
              Safely exports an exact snapshot of your products, stock movements, sales, and settings to a timestamped SQLite database file.
            </p>
          </div>

          <button
            onClick={handleCreateBackup}
            disabled={isProcessing}
            className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-sm flex items-center justify-center gap-2 transition-colors"
          >
            <Download className="w-4 h-4" />
            <span>{isProcessing ? 'Creating Backup...' : 'Create Backup Snapshot'}</span>
          </button>
        </div>

        {/* Restore Backup */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm flex flex-col justify-between space-y-4">
          <div>
            <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center mb-3">
              <Upload className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-sm text-slate-900">Restore from Backup</h3>
            <p className="text-xs text-slate-500 mt-1">
              Validates header integrity and creates a safety snapshot of the active database before safely reloading records.
            </p>
          </div>

          <button
            onClick={handleRestoreBackup}
            disabled={isProcessing}
            className="w-full py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shadow-sm flex items-center justify-center gap-2 transition-colors"
          >
            <Upload className="w-4 h-4" />
            <span>{isProcessing ? 'Processing...' : 'Select Backup File & Restore'}</span>
          </button>
        </div>
      </div>

      {/* CSV Export Utilities */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-3">
        <h3 className="font-bold text-sm text-slate-800">Spreadsheet Data Portability (CSV)</h3>
        <p className="text-xs text-slate-500">
          Open your business records in Microsoft Excel, Google Sheets, or LibreOffice Calc. Formula injection protection is applied automatically.
        </p>

        <div className="flex gap-3 pt-2">
          <button
            onClick={handleExportProductsCsv}
            className="px-4 py-2 rounded-lg border border-slate-200 hover:bg-slate-50 text-xs font-semibold text-slate-700 flex items-center gap-2 transition-colors"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
            <span>Export Products CSV</span>
          </button>

          <button
            onClick={handleExportSalesCsv}
            className="px-4 py-2 rounded-lg border border-slate-200 hover:bg-slate-50 text-xs font-semibold text-slate-700 flex items-center gap-2 transition-colors"
          >
            <FileSpreadsheet className="w-4 h-4 text-blue-600" />
            <span>Export Sales CSV</span>
          </button>
        </div>
      </div>

      {/* Backup History Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <History className="w-4 h-4 text-slate-500" />
            <h3 className="font-bold text-sm text-slate-800">Backup & Restore Activity Log</h3>
          </div>
          <button onClick={loadData} className="text-slate-400 hover:text-slate-700">
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 text-[10px] text-slate-500 uppercase border-b border-slate-200 font-semibold">
                <th className="py-2.5 px-4">Date & Time</th>
                <th className="py-2.5 px-3">Filename</th>
                <th className="py-2.5 px-3">Size</th>
                <th className="py-2.5 px-3">Path</th>
                <th className="py-2.5 px-4 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {history.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-400">
                    No backups created yet. Click "Create Backup Snapshot" above.
                  </td>
                </tr>
              ) : (
                history.map((h) => (
                  <tr key={h.id} className="hover:bg-slate-50">
                    <td className="py-2.5 px-4 text-slate-500 whitespace-nowrap">{formatDateTime(h.createdAt)}</td>
                    <td className="py-2.5 px-3 font-semibold text-slate-800">{h.filename}</td>
                    <td className="py-2.5 px-3 text-slate-600 font-mono">{(h.fileSizeBytes / 1024).toFixed(1)} KB</td>
                    <td className="py-2.5 px-3 text-slate-400 font-mono text-[10px] max-w-xs truncate">{h.filePath}</td>
                    <td className="py-2.5 px-4 text-center">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                        {h.status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

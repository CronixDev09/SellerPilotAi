import React from 'react';
import {
  Sun,
  Calendar,
  Wifi,
  Bot,
  Bell,
  AlertTriangle,
} from 'lucide-react';
import { BusinessSettings, AiModelStatus } from '../../../../shared/types';

interface HeaderProps {
  settings: BusinessSettings | null;
  aiStatus: AiModelStatus | null;
  selectedPeriod: number;
  onPeriodChange: (days: number) => void;
  reorderAlertCount?: number;
  onOpenRestock?: () => void;
  onOpenSettings?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  settings,
  aiStatus,
  selectedPeriod,
  onPeriodChange,
  reorderAlertCount = 0,
  onOpenRestock,
  onOpenSettings,
}) => {
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  };

  const periodOptions = [
    { label: 'Today', value: 1 },
    { label: 'Last 7 days', value: 7 },
    { label: 'Last 30 days', value: 30 },
    { label: 'Last 90 days', value: 90 },
  ];

  const businessName = settings?.businessName || 'Business Store';
  const initial = businessName.charAt(0).toUpperCase() || 'S';

  return (
    <header className="h-20 bg-white border-b border-slate-200/80 px-8 flex items-center justify-between shrink-0 sticky top-0 z-10">
      {/* Left: Greeting & Subtitle */}
      <div>
        <div className="flex items-center gap-2">
          <Sun className="w-5 h-5 text-amber-500 fill-amber-500/20" />
          <h2 className="text-xl font-bold text-slate-800 tracking-tight">
            {getGreeting()}, <span className="text-slate-900">{businessName}</span>
          </h2>
        </div>
        <p className="text-xs text-slate-500 mt-0.5">Here's your store overview</p>
      </div>

      {/* Right: Controls & Status Badges */}
      <div className="flex items-center gap-3">
        {/* Period Selector */}
        <div className="relative inline-flex items-center">
          <Calendar className="w-4 h-4 text-slate-400 absolute left-3 pointer-events-none" />
          <select
            value={selectedPeriod}
            onChange={(e) => onPeriodChange(Number(e.target.value))}
            className="pl-9 pr-8 py-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer transition-colors appearance-none"
          >
            {periodOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <div className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400">
            ▼
          </div>
        </div>

        {/* Offline Ready Status */}
        <div
          title="All inventory, sales, and analytics operate 100% locally on your computer with zero cloud dependency."
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-50 border border-emerald-200/80 text-emerald-700 text-xs font-medium cursor-help"
        >
          <Wifi className="w-3.5 h-3.5 text-emerald-600" />
          <span>Offline ready</span>
        </div>

        {/* Local AI Status */}
        <div
          onClick={onOpenSettings}
          title={
            aiStatus?.available && aiStatus?.isModelReady
              ? `Local AI connected (${aiStatus.selectedModel})`
              : 'Local AI offline. Click to view Ollama setup guide in Settings.'
          }
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium cursor-pointer transition-colors ${
            aiStatus?.available && aiStatus?.isModelReady
              ? 'bg-emerald-50 border border-emerald-200/80 text-emerald-700 hover:bg-emerald-100'
              : 'bg-slate-100 border border-slate-200 text-slate-600 hover:bg-slate-200'
          }`}
        >
          <Bot className="w-3.5 h-3.5" />
          <span>
            {aiStatus?.available && aiStatus?.isModelReady ? 'AI ready' : 'AI offline'}
          </span>
        </div>

        {/* Notification Bell */}
        <button
          onClick={onOpenRestock}
          title={
            reorderAlertCount > 0
              ? `${reorderAlertCount} items require restocking attention`
              : 'No pending alerts'
          }
          className="relative p-2 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors"
        >
          <Bell className="w-4 h-4" />
          {reorderAlertCount > 0 && (
            <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-rose-500 ring-2 ring-white animate-pulse" />
          )}
        </button>

        {/* Store Profile Avatar */}
        <button
          onClick={onOpenSettings}
          className="w-9 h-9 rounded-full bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-xs flex items-center justify-center border border-slate-300 transition-colors"
        >
          {initial}
        </button>
      </div>
    </header>
  );
};

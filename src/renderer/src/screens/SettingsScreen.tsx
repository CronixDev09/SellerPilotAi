import React, { useState, useEffect } from 'react';
import {
  Settings,
  Store,
  Bot,
  Sliders,
  Database,
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  RefreshCw,
  Trash2,
} from 'lucide-react';
import { BusinessSettings, AiModelStatus, CurrencyCode } from '../../../shared/types';

interface SettingsScreenProps {
  settings: BusinessSettings | null;
  aiStatus: AiModelStatus | null;
  onUpdateSettings: (newSettings: Partial<BusinessSettings>) => Promise<void>;
  onSeedDemo: () => Promise<void>;
  onResetDemo: () => Promise<void>;
  onNotify: (msg: string, type?: 'success' | 'error' | 'info') => void;
  onRefreshAi: () => Promise<void>;
}

export const SettingsScreen: React.FC<SettingsScreenProps> = ({
  settings,
  aiStatus,
  onUpdateSettings,
  onSeedDemo,
  onResetDemo,
  onNotify,
  onRefreshAi,
}) => {
  const [businessName, setBusinessName] = useState(settings?.businessName || '');
  const [businessType, setBusinessType] = useState(settings?.businessType || 'Retail');
  const [currency, setCurrency] = useState<CurrencyCode>(settings?.currency || 'INR');
  const [country, setCountry] = useState(settings?.country || 'India');
  const [targetCoverageDays, setTargetCoverageDays] = useState(settings?.targetStockCoverageDays || 30);
  const [warningThresholdDays, setWarningThresholdDays] = useState(settings?.warningThresholdDays || 7);

  // AI Config
  const [aiEndpoint, setAiEndpoint] = useState(aiStatus?.endpoint || 'http://127.0.0.1:11434');
  const [selectedModel, setSelectedModel] = useState(aiStatus?.selectedModel || 'gemma:2b');
  const [isTestingAi, setIsTestingAi] = useState(false);

  useEffect(() => {
    if (settings) {
      setBusinessName(settings.businessName);
      setBusinessType(settings.businessType);
      setCurrency(settings.currency);
      setCountry(settings.country);
      setTargetCoverageDays(settings.targetStockCoverageDays);
      setWarningThresholdDays(settings.warningThresholdDays);
    }
  }, [settings]);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await onUpdateSettings({
        businessName,
        businessType,
        currency,
        country,
        targetStockCoverageDays: Number(targetCoverageDays),
        warningThresholdDays: Number(warningThresholdDays),
      });
      onNotify('Business settings saved successfully', 'success');
    } catch (err: any) {
      onNotify('Failed to save settings', 'error');
    }
  };

  const handleSaveAiConfig = async () => {
    try {
      setIsTestingAi(true);
      await window.sellerPilot.setAiConfig({
        endpoint: aiEndpoint,
        model: selectedModel,
      });
      await onRefreshAi();
      onNotify('AI configuration saved and connection tested', 'success');
    } catch (err: any) {
      onNotify('Failed to connect to AI runtime', 'error');
    } finally {
      setIsTestingAi(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl pb-16">
      <div>
        <h2 className="text-xl font-bold text-slate-800">Application Settings</h2>
        <p className="text-xs text-slate-500 mt-0.5">
          Configure business details, currency formatting, local AI runtime, and demonstration data
        </p>
      </div>

      {/* 1. Business Profile Form */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-4">
        <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
          <Store className="w-5 h-5 text-blue-600" />
          <h3 className="font-bold text-sm text-slate-800">Business Profile</h3>
        </div>

        <form onSubmit={handleSaveProfile} className="space-y-4 text-xs">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Business Name *</label>
              <input
                type="text"
                required
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Business Type</label>
              <input
                type="text"
                value={businessType}
                onChange={(e) => setBusinessType(e.target.value)}
                placeholder="e.g. Electronics, Clothing, Grocery"
                className="w-full px-3 py-2 rounded-lg border border-slate-200 font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Currency</label>
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value as CurrencyCode)}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 font-semibold focus:ring-2 focus:ring-blue-500 focus:outline-none"
              >
                <option value="INR">INR (₹ - Indian Rupee)</option>
                <option value="USD">USD ($ - US Dollar)</option>
                <option value="EUR">EUR (€ - Euro)</option>
                <option value="GBP">GBP (£ - British Pound)</option>
                <option value="CAD">CAD (CA$ - Canadian Dollar)</option>
                <option value="AUD">AUD (AU$ - Australian Dollar)</option>
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Country</label>
              <input
                type="text"
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 pt-2 border-t border-slate-100">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Default Target Coverage (Days)
              </label>
              <input
                type="number"
                min="7"
                max="180"
                value={targetCoverageDays}
                onChange={(e) => setTargetCoverageDays(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
              <p className="text-[10px] text-slate-400 mt-0.5">Used by the Smart Restock Planner</p>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Stock Warning Threshold (Days of Stock)
              </label>
              <input
                type="number"
                min="1"
                max="30"
                value={warningThresholdDays}
                onChange={(e) => setWarningThresholdDays(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
              <p className="text-[10px] text-slate-400 mt-0.5">Triggers warning indicators</p>
            </div>
          </div>

          <div className="pt-3 flex justify-end">
            <button
              type="submit"
              className="px-5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-sm transition-colors"
            >
              Save Profile Settings
            </button>
          </div>
        </form>
      </div>

      {/* 2. Local AI Configuration */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Bot className="w-5 h-5 text-blue-600" />
            <h3 className="font-bold text-sm text-slate-800">Local AI Inference (Ollama)</h3>
          </div>
          <span
            className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
              aiStatus?.available && aiStatus?.isModelReady
                ? 'bg-emerald-100 text-emerald-800'
                : 'bg-slate-200 text-slate-700'
            }`}
          >
            {aiStatus?.available && aiStatus?.isModelReady ? 'Ollama Online' : 'Ollama Offline'}
          </span>
        </div>

        <div className="space-y-4 text-xs">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Ollama API Endpoint</label>
              <input
                type="text"
                value={aiEndpoint}
                onChange={(e) => setAiEndpoint(e.target.value)}
                placeholder="http://127.0.0.1:11434"
                className="w-full px-3 py-2 rounded-lg border border-slate-200 font-mono text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Model Name</label>
              <input
                type="text"
                value={selectedModel}
                onChange={(e) => setSelectedModel(e.target.value)}
                placeholder="e.g. gemma:2b, gemma:7b, llama3"
                className="w-full px-3 py-2 rounded-lg border border-slate-200 font-mono text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="flex items-center justify-between pt-2">
            <div className="text-[11px] text-slate-500">
              {aiStatus?.installedModels && aiStatus.installedModels.length > 0 ? (
                <span>Detected models: {aiStatus.installedModels.join(', ')}</span>
              ) : (
                <span>No Ollama models detected locally.</span>
              )}
            </div>

            <button
              onClick={handleSaveAiConfig}
              disabled={isTestingAi}
              className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs flex items-center gap-2 shadow-sm transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isTestingAi ? 'animate-spin' : ''}`} />
              <span>{isTestingAi ? 'Testing...' : 'Test Connection & Save'}</span>
            </button>
          </div>

          {/* Quick Setup Instructions Callout */}
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
            <div className="flex items-center gap-2 font-bold text-slate-800">
              <ExternalLink className="w-4 h-4 text-blue-600" />
              <span>How to setup Ollama on Windows:</span>
            </div>
            <ol className="list-decimal list-inside space-y-1 text-slate-600">
              <li>
                Download and install Ollama from <span className="font-semibold text-blue-600">https://ollama.com/download</span>.
              </li>
              <li>
                Open PowerShell or Command Prompt and run:{' '}
                <code className="bg-slate-200 px-1.5 py-0.5 rounded font-mono text-[11px] text-slate-800">
                  ollama run gemma:2b
                </code>
              </li>
              <li>Once downloaded, click "Test Connection & Save" above. SellerPilot AI will detect it automatically!</li>
            </ol>
            <p className="text-[11px] text-slate-400 pt-1">
              Note: SellerPilot operates completely offline. When Ollama is offline, the built-in deterministic engine handles all business calculations seamlessly.
            </p>
          </div>
        </div>
      </div>

      {/* 3. Demonstration Mode & Sample Data */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-4">
        <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
          <Sparkles className="w-5 h-5 text-purple-600" />
          <h3 className="font-bold text-sm text-slate-800">Demonstration Mode</h3>
        </div>

        <p className="text-xs text-slate-600">
          Load a realistic sample store (matching the visual product reference with Electronics, Accessories, Home, and Clothing categories, historical sales records, and restock alerts) to test and showcase the application.
        </p>

        <div className="flex items-center gap-3 pt-2">
          <button
            onClick={async () => {
              const ok = confirm(
                'Load demonstration data?\n\nThis will populate your database with sample products and sales records for demonstration purposes.'
              );
              if (ok) {
                await onSeedDemo();
                onNotify('Demonstration store loaded successfully', 'success');
              }
            }}
            className="px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs flex items-center gap-2 shadow-sm transition-colors"
          >
            <Sparkles className="w-4 h-4" />
            <span>Load Demo Store Data</span>
          </button>

          <button
            onClick={async () => {
              const ok = confirm(
                'Reset all demo data?\n\nThis will clear sample products, sales, and stock movements, giving you a clean slate.'
              );
              if (ok) {
                await onResetDemo();
                onNotify('Store reset to clean slate', 'info');
              }
            }}
            className="px-4 py-2.5 rounded-xl border border-rose-200 hover:bg-rose-50 text-rose-700 font-bold text-xs flex items-center gap-2 transition-colors"
          >
            <Trash2 className="w-4 h-4 text-rose-600" />
            <span>Reset to Clean Slate</span>
          </button>
        </div>
      </div>
    </div>
  );
};

import React, { useState } from 'react';
import {
  Boxes,
  Shield,
  Store,
  Package,
  Bot,
  HardDrive,
  CheckCircle2,
  ChevronRight,
  Sparkles,
  Upload,
  Plus,
} from 'lucide-react';
import { BusinessSettings, AiModelStatus, CurrencyCode } from '../../../../shared/types';

interface OnboardingWizardProps {
  aiStatus: AiModelStatus | null;
  onComplete: (settings: Partial<BusinessSettings>, seedDemo: boolean) => Promise<void>;
}

export const OnboardingWizard: React.FC<OnboardingWizardProps> = ({
  aiStatus,
  onComplete,
}) => {
  const [step, setStep] = useState(1);
  const [businessName, setBusinessName] = useState('My Retail Store');
  const [businessType, setBusinessType] = useState('Electronics & Retail');
  const [currency, setCurrency] = useState<CurrencyCode>('INR');
  const [country, setCountry] = useState('India');
  const [inventoryChoice, setInventoryChoice] = useState<'demo' | 'manual' | 'csv'>('demo');

  const handleFinish = async () => {
    await onComplete(
      {
        businessName,
        businessType,
        currency,
        country,
        language: 'en',
        isOnboarded: true,
      },
      inventoryChoice === 'demo'
    );
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-6 select-none">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-xl overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-200">
        {/* Progress Header */}
        <div className="px-8 pt-8 pb-4 border-b border-slate-100">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white font-bold">
                <Boxes className="w-4 h-4" />
              </div>
              <span className="font-bold text-slate-800 text-sm">SellerPilot AI Setup</span>
            </div>
            <span className="text-xs font-semibold text-slate-400">Step {step} of 5</span>
          </div>

          <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
            <div
              className="bg-blue-600 h-full transition-all duration-300"
              style={{ width: `${(step / 5) * 100}%` }}
            />
          </div>
        </div>

        {/* Step Body */}
        <div className="p-8 space-y-6">
          {/* STEP 1: Welcome & Local Data Ownership */}
          {step === 1 && (
            <div className="space-y-4 text-center">
              <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-2">
                <Shield className="w-8 h-8" />
              </div>
              <h2 className="text-xl font-bold text-slate-900">Welcome to SellerPilot AI</h2>
              <p className="text-xs text-slate-500 leading-relaxed max-w-md mx-auto">
                SellerPilot AI is an offline-first inventory and sales management desktop application designed for small business owners and online sellers.
              </p>
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl text-left text-xs space-y-2 text-slate-700">
                <div className="flex items-center gap-2 font-semibold text-slate-900">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>100% Local Data Ownership</span>
                </div>
                <p className="text-slate-500 text-[11px] pl-6">
                  Your business records, products, and financial transactions are stored locally on this machine using SQLite. Zero cloud account required.
                </p>
              </div>
            </div>
          )}

          {/* STEP 2: Business Details */}
          {step === 2 && (
            <div className="space-y-4 text-xs">
              <div>
                <h3 className="text-base font-bold text-slate-900">Tell Us About Your Business</h3>
                <p className="text-slate-500 mt-0.5">Customize your receipt headings and currency formatting</p>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Business / Store Name *</label>
                <input
                  type="text"
                  required
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Business Type</label>
                  <input
                    type="text"
                    value={businessType}
                    onChange={(e) => setBusinessType(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>

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
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: Inventory Setup */}
          {step === 3 && (
            <div className="space-y-4 text-xs">
              <div>
                <h3 className="text-base font-bold text-slate-900">How would you like to start?</h3>
                <p className="text-slate-500 mt-0.5">Choose how to initialize your catalog</p>
              </div>

              <div className="space-y-2.5">
                {[
                  {
                    id: 'demo' as const,
                    title: 'Load Demonstration Store (Recommended)',
                    desc: 'Instantly explore the app with realistic products, sales curves, and restock attention matching the visual demo.',
                    icon: Sparkles,
                    color: 'text-purple-600 bg-purple-50',
                  },
                  {
                    id: 'manual' as const,
                    title: 'Start with an Empty Store',
                    desc: 'Add your own products manually via the catalog manager.',
                    icon: Plus,
                    color: 'text-blue-600 bg-blue-50',
                  },
                  {
                    id: 'csv' as const,
                    title: 'Import from CSV Spreadsheet',
                    desc: 'Upload an existing CSV spreadsheet of products after setup.',
                    icon: Upload,
                    color: 'text-emerald-600 bg-emerald-50',
                  },
                ].map((opt) => {
                  const Icon = opt.icon;
                  const isSelected = inventoryChoice === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setInventoryChoice(opt.id)}
                      className={`w-full p-4 rounded-xl border text-left flex items-start gap-3 transition-all ${
                        isSelected
                          ? 'border-blue-600 bg-blue-50/50 shadow-sm'
                          : 'border-slate-200 hover:border-slate-300 bg-white'
                      }`}
                    >
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${opt.color}`}>
                        <Icon className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="font-bold text-slate-900 text-xs">{opt.title}</h4>
                        <p className="text-[11px] text-slate-500 mt-0.5">{opt.desc}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* STEP 4: Local AI Setup */}
          {step === 4 && (
            <div className="space-y-4 text-xs">
              <div>
                <h3 className="text-base font-bold text-slate-900">Local Open-Weight AI Assistant</h3>
                <p className="text-slate-500 mt-0.5">Detecting local Ollama runtime</p>
              </div>

              <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-700">Ollama Runtime Status:</span>
                  <span
                    className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${
                      aiStatus?.available && aiStatus?.isModelReady
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-slate-200 text-slate-700'
                    }`}
                  >
                    {aiStatus?.available && aiStatus?.isModelReady ? 'Ready' : 'Not Connected'}
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  SellerPilot uses open-weight models (like Google Gemma) running locally via Ollama to generate listings and explain business data. You can run all core inventory and sales features without AI.
                </p>
              </div>

              <div className="p-3 bg-blue-50 border border-blue-100 rounded-lg text-blue-900 text-[11px]">
                You can configure and test your local model anytime in the Settings screen.
              </div>
            </div>
          )}

          {/* STEP 5: Backup Setup */}
          {step === 5 && (
            <div className="space-y-4 text-xs">
              <div>
                <h3 className="text-base font-bold text-slate-900">Data Protection & Backups</h3>
                <p className="text-slate-500 mt-0.5">Your business continuity strategy</p>
              </div>

              <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-3">
                <div className="flex items-center gap-2 font-bold text-slate-900">
                  <HardDrive className="w-4 h-4 text-blue-600" />
                  <span>Local SQLite Storage</span>
                </div>
                <p className="text-slate-500 text-[11px] leading-relaxed">
                  Your database is safely kept in your local application directory. We recommend taking regular weekly backups using the Backup & Restore screen and saving them to an external drive.
                </p>
              </div>

              <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-xl text-emerald-900 font-semibold flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                <span>Everything is configured! You're ready to launch SellerPilot AI.</span>
              </div>
            </div>
          )}
        </div>

        {/* Wizard Footer Controls */}
        <div className="px-8 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
          {step > 1 ? (
            <button
              onClick={() => setStep(step - 1)}
              className="px-4 py-2 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition-colors"
            >
              Back
            </button>
          ) : (
            <div />
          )}

          {step < 5 ? (
            <button
              onClick={() => setStep(step + 1)}
              className="px-5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm transition-colors"
            >
              <span>Next</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={handleFinish}
              className="px-6 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm transition-colors"
            >
              <span>Launch SellerPilot</span>
              <CheckCircle2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

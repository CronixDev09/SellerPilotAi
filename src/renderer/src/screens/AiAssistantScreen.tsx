import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  Bot,
  Copy,
  Check,
  Send,
  HelpCircle,
  AlertCircle,
  Lightbulb,
  ExternalLink,
  Plus,
  Trash2,
  Cpu,
} from 'lucide-react';
import {
  AiModelStatus,
  AiListingPromptInput,
  AiListingOutput,
  AiBusinessInsight,
  Product,
} from '../../../shared/types';

interface AiAssistantScreenProps {
  aiStatus: AiModelStatus | null;
  onNotify: (msg: string, type?: 'success' | 'error' | 'info') => void;
  onOpenSettings: () => void;
}

export const AiAssistantScreen: React.FC<AiAssistantScreenProps> = ({
  aiStatus,
  onNotify,
  onOpenSettings,
}) => {
  const [activeTab, setActiveTab] = useState<'insights' | 'listings'>('insights');

  // Capability A: Listing Generator State
  const [products, setProducts] = useState<Product[]>([]);
  const [listingInput, setListingInput] = useState<AiListingPromptInput>({
    productName: '',
    brand: '',
    category: '',
    confirmedSpecs: {},
    intendedSalesChannel: 'Online & Retail Store',
    language: 'English',
    brandVoice: 'Professional, trustworthy, and clear',
  });
  const [newSpecKey, setNewSpecKey] = useState('');
  const [newSpecVal, setNewSpecVal] = useState('');
  const [generatingListing, setGeneratingListing] = useState(false);
  const [generatedListing, setGeneratedListing] = useState<AiListingOutput | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // Capability B: Business Insights State
  const [userQuestion, setUserQuestion] = useState('');
  const [askingQuestion, setAskingQuestion] = useState(false);
  const [insightResult, setInsightResult] = useState<AiBusinessInsight | null>(null);

  useEffect(() => {
    window.sellerPilot.getProducts().then(setProducts).catch(console.error);
  }, []);

  const handleSelectProductPreset = (p: Product) => {
    setListingInput({
      productName: p.name,
      brand: p.brand || '',
      category: p.categoryName || '',
      confirmedSpecs: {
        SKU: p.sku,
        Unit: p.unit,
        ...(p.barcode ? { Barcode: p.barcode } : {}),
      },
      intendedSalesChannel: 'Online & Retail Store',
      language: 'English',
      brandVoice: 'Professional, trustworthy, and clear',
    });
  };

  const handleAddSpec = () => {
    if (!newSpecKey.trim() || !newSpecVal.trim()) return;
    setListingInput((prev) => ({
      ...prev,
      confirmedSpecs: {
        ...prev.confirmedSpecs,
        [newSpecKey.trim()]: newSpecVal.trim(),
      },
    }));
    setNewSpecKey('');
    setNewSpecVal('');
  };

  const handleRemoveSpec = (key: string) => {
    setListingInput((prev) => {
      const next = { ...prev.confirmedSpecs };
      delete next[key];
      return { ...prev, confirmedSpecs: next };
    });
  };

  const handleGenerateListing = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!listingInput.productName.trim()) {
      onNotify('Product name is required', 'error');
      return;
    }

    try {
      setGeneratingListing(true);
      const output = await window.sellerPilot.generateAiListing(listingInput);
      setGeneratedListing(output);
      onNotify('Product listing generated successfully', 'success');
    } catch (err: any) {
      onNotify(err.message || 'Listing generation failed', 'error');
    } finally {
      setGeneratingListing(false);
    }
  };

  const handleAskQuestion = async (qText?: string) => {
    const q = qText || userQuestion;
    if (!q.trim()) return;

    try {
      setAskingQuestion(true);
      setUserQuestion(q);
      const res = await window.sellerPilot.getAiInsights(q);
      setInsightResult(res);
    } catch (err: any) {
      onNotify(err.message || 'Failed to process inquiry', 'error');
    } finally {
      setAskingQuestion(false);
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(label);
    setTimeout(() => setCopiedField(null), 2000);
    onNotify(`Copied ${label} to clipboard`, 'info');
  };

  const sampleQuestions = [
    'Which products generated the most revenue this month?',
    'Which products require restocking right now?',
    'Which categories have the highest sales volume?',
    'Which products have had no sales recently?',
  ];

  return (
    <div className="space-y-6 pb-12">
      {/* Top AI Status Notice Banner */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div
            className={`w-10 h-10 rounded-lg flex items-center justify-center ${
              aiStatus?.available && aiStatus?.isModelReady
                ? 'bg-emerald-50 text-emerald-600 border border-emerald-100'
                : 'bg-slate-100 text-slate-500 border border-slate-200'
            }`}
          >
            <Bot className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-sm text-slate-800">Local Open-Weight AI</h3>
              {aiStatus?.available && aiStatus?.isModelReady ? (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                  Ready ({aiStatus.selectedModel})
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-200 text-slate-700">
                  Offline Fallback Engine
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              {aiStatus?.available && aiStatus?.isModelReady
                ? 'Inference running 100% locally via Ollama. No business records ever leave your PC.'
                : 'Ollama is offline or model is not loaded. Operating via deterministic business intelligence & heuristic generator.'}
            </p>
          </div>
        </div>

        <button
          onClick={onOpenSettings}
          className="px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-xs font-semibold text-slate-700 transition-colors"
        >
          AI Settings & Guide
        </button>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-6 border-b border-slate-200">
        <button
          onClick={() => setActiveTab('insights')}
          className={`pb-3 text-sm font-bold flex items-center gap-2 border-b-2 transition-colors ${
            activeTab === 'insights'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Sparkles className="w-4 h-4" />
          <span>Business Insights Assistant</span>
        </button>

        <button
          onClick={() => setActiveTab('listings')}
          className={`pb-3 text-sm font-bold flex items-center gap-2 border-b-2 transition-colors ${
            activeTab === 'listings'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Cpu className="w-4 h-4" />
          <span>Product Listing Generator</span>
        </button>
      </div>

      {/* TAB 1: Business Insights Assistant */}
      {activeTab === 'insights' && (
        <div className="space-y-6">
          {/* Question Prompt Bar */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-3">
            <h3 className="font-bold text-sm text-slate-800">Ask a Question About Your Store</h3>
            <p className="text-xs text-slate-500">
              Inquiries are calculated deterministically against your actual SQLite records first, preventing hallucinated numbers.
            </p>

            <div className="flex gap-2">
              <input
                type="text"
                placeholder="e.g. Which products generated the most revenue this month?"
                value={userQuestion}
                onChange={(e) => setUserQuestion(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAskQuestion()}
                className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
              <button
                onClick={() => handleAskQuestion()}
                disabled={askingQuestion || !userQuestion.trim()}
                className={`px-5 py-2.5 rounded-xl text-xs font-bold text-white flex items-center gap-2 shadow-sm transition-colors ${
                  askingQuestion || !userQuestion.trim()
                    ? 'bg-slate-300 cursor-not-allowed'
                    : 'bg-blue-600 hover:bg-blue-700'
                }`}
              >
                <Send className="w-3.5 h-3.5" />
                <span>{askingQuestion ? 'Analyzing...' : 'Ask AI'}</span>
              </button>
            </div>

            {/* Quick Sample Questions */}
            <div className="flex flex-wrap items-center gap-2 pt-2">
              <span className="text-[11px] font-semibold text-slate-400">Quick inquiries:</span>
              {sampleQuestions.map((q, i) => (
                <button
                  key={i}
                  onClick={() => handleAskQuestion(q)}
                  className="px-2.5 py-1 rounded-full border border-slate-200 bg-slate-50 hover:bg-blue-50 hover:text-blue-700 hover:border-blue-200 text-[11px] text-slate-600 font-medium transition-colors"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>

          {/* Insight Answer Card */}
          {insightResult && (
            <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-5 animate-in fade-in duration-200">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-blue-600" />
                  <h3 className="font-bold text-sm text-slate-800">Analysis for: "{insightResult.userQuestion}"</h3>
                </div>
                <span className="text-[11px] text-slate-400">
                  {insightResult.isAiGenerated ? 'Synthesized via Ollama' : 'Deterministic Analysis'}
                </span>
              </div>

              {/* Natural Language Summary */}
              <div className="p-4 bg-slate-50/80 rounded-xl border border-slate-200 text-xs text-slate-800 leading-relaxed whitespace-pre-line font-medium">
                {insightResult.naturalLanguageAnswer}
              </div>

              {/* Verified Deterministic Database Figures */}
              <div>
                <h4 className="font-bold text-xs text-slate-700 mb-2">Verified Database Records:</h4>
                <div className="p-3 bg-slate-900 text-slate-200 font-mono text-[11px] rounded-lg overflow-x-auto">
                  <pre>{JSON.stringify(insightResult.calculatedData, null, 2)}</pre>
                </div>
              </div>

              {/* Actionable Recommendations */}
              {insightResult.recommendations.length > 0 && (
                <div className="p-4 bg-blue-50/70 border border-blue-100 rounded-xl space-y-2">
                  <div className="flex items-center gap-2 font-bold text-xs text-blue-900">
                    <Lightbulb className="w-4 h-4 text-blue-600" />
                    <span>Actionable Recommendations:</span>
                  </div>
                  <ul className="space-y-1.5 list-disc list-inside text-xs text-blue-800">
                    {insightResult.recommendations.map((rec, i) => (
                      <li key={i}>{rec}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: Product Listing Generator */}
      {activeTab === 'listings' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Form (5 cols) */}
          <form
            onSubmit={handleGenerateListing}
            className="lg:col-span-5 bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-4"
          >
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="font-bold text-sm text-slate-800">Product Input</h3>
              {products.length > 0 && (
                <select
                  onChange={(e) => {
                    const prod = products.find((p) => p.id === Number(e.target.value));
                    if (prod) handleSelectProductPreset(prod);
                  }}
                  className="text-[11px] font-semibold text-blue-600 bg-blue-50 px-2 py-1 rounded border border-blue-100 focus:outline-none cursor-pointer"
                >
                  <option value="">Load from catalog...</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.sku})
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Product Name *</label>
              <input
                type="text"
                required
                placeholder="e.g. Ergonomic Wireless Mouse"
                value={listingInput.productName}
                onChange={(e) => setListingInput({ ...listingInput, productName: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Brand</label>
                <input
                  type="text"
                  placeholder="e.g. LogiTech"
                  value={listingInput.brand}
                  onChange={(e) => setListingInput({ ...listingInput, brand: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Category</label>
                <input
                  type="text"
                  placeholder="e.g. Computer Accessories"
                  value={listingInput.category}
                  onChange={(e) => setListingInput({ ...listingInput, category: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>
            </div>

            {/* Confirmed Specifications */}
            <div className="space-y-2">
              <label className="block text-xs font-semibold text-slate-700">Confirmed Specifications</label>
              <p className="text-[10px] text-slate-400">AI will not invent claims or unverified specs.</p>

              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Spec (e.g. Battery Life)"
                  value={newSpecKey}
                  onChange={(e) => setNewSpecKey(e.target.value)}
                  className="w-1/2 px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs"
                />
                <input
                  type="text"
                  placeholder="Value (e.g. 12 Months)"
                  value={newSpecVal}
                  onChange={(e) => setNewSpecVal(e.target.value)}
                  className="w-1/2 px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs"
                />
                <button
                  type="button"
                  onClick={handleAddSpec}
                  className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 rounded-lg text-slate-700 font-bold"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="space-y-1 max-h-28 overflow-y-auto pt-1">
                {Object.entries(listingInput.confirmedSpecs).map(([k, v]) => (
                  <div key={k} className="flex items-center justify-between p-1.5 bg-slate-50 rounded text-xs">
                    <span className="font-semibold text-slate-700">{k}: {v}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveSpec(k)}
                      className="text-slate-400 hover:text-rose-600"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Tone / Voice</label>
                <select
                  value={listingInput.brandVoice}
                  onChange={(e) => setListingInput({ ...listingInput, brandVoice: e.target.value })}
                  className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs"
                >
                  <option value="Professional, trustworthy, and clear">Professional</option>
                  <option value="Modern, friendly, and engaging">Friendly & Modern</option>
                  <option value="Technical, precise, and spec-focused">Technical</option>
                  <option value="Luxury, premium, and refined">Premium</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Language</label>
                <select
                  value={listingInput.language}
                  onChange={(e) => setListingInput({ ...listingInput, language: e.target.value })}
                  className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs"
                >
                  <option value="English">English</option>
                  <option value="Hindi">Hindi</option>
                  <option value="Hinglish">Hinglish</option>
                </select>
              </div>
            </div>

            <button
              type="submit"
              disabled={generatingListing}
              className={`w-full py-2.5 rounded-xl text-xs font-bold text-white flex items-center justify-center gap-2 shadow-sm transition-colors ${
                generatingListing ? 'bg-slate-300 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'
              }`}
            >
              <Sparkles className="w-4 h-4" />
              <span>{generatingListing ? 'Synthesizing...' : 'Generate Listing Copy'}</span>
            </button>
          </form>

          {/* Right Generated Listing Cards (7 cols) */}
          <div className="lg:col-span-7 bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-4">
            <h3 className="font-bold text-sm text-slate-800 pb-2 border-b border-slate-100">
              Generated Listing Output
            </h3>

            {!generatedListing ? (
              <div className="py-20 text-center text-slate-400 text-xs">
                <Bot className="w-10 h-10 mx-auto mb-2 opacity-40" />
                Fill out product details on the left and click Generate Listing Copy.
              </div>
            ) : (
              <div className="space-y-4 text-xs animate-in fade-in duration-200">
                {/* Title */}
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 relative group">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] font-semibold text-slate-500 uppercase">Product Title</span>
                    <button
                      onClick={() => copyToClipboard(generatedListing.title, 'Title')}
                      className="text-slate-400 hover:text-blue-600 flex items-center gap-1"
                    >
                      {copiedField === 'Title' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                  <h4 className="font-bold text-slate-900 text-sm">{generatedListing.title}</h4>
                </div>

                {/* Short Description */}
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] font-semibold text-slate-500 uppercase">Short Description</span>
                    <button
                      onClick={() => copyToClipboard(generatedListing.shortDescription, 'Short Description')}
                      className="text-slate-400 hover:text-blue-600 flex items-center gap-1"
                    >
                      {copiedField === 'Short Description' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                  <p className="text-slate-700">{generatedListing.shortDescription}</p>
                </div>

                {/* Detailed Description */}
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] font-semibold text-slate-500 uppercase">Detailed Description</span>
                    <button
                      onClick={() => copyToClipboard(generatedListing.detailedDescription, 'Detailed Description')}
                      className="text-slate-400 hover:text-blue-600 flex items-center gap-1"
                    >
                      {copiedField === 'Detailed Description' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                  <p className="text-slate-700 whitespace-pre-line leading-relaxed">{generatedListing.detailedDescription}</p>
                </div>

                {/* Bullet Points */}
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[10px] font-semibold text-slate-500 uppercase">Key Features</span>
                    <button
                      onClick={() => copyToClipboard(generatedListing.keyFeatures.join('\n• '), 'Features')}
                      className="text-slate-400 hover:text-blue-600 flex items-center gap-1"
                    >
                      {copiedField === 'Features' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                  <ul className="space-y-1 list-disc list-inside text-slate-700">
                    {generatedListing.keyFeatures.map((f, i) => (
                      <li key={i}>{f}</li>
                    ))}
                  </ul>
                </div>

                {/* Keywords Chips */}
                <div>
                  <span className="text-[10px] font-semibold text-slate-500 uppercase block mb-1.5">Search Keywords</span>
                  <div className="flex flex-wrap gap-1.5">
                    {generatedListing.searchKeywords.map((k, i) => (
                      <span key={i} className="px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200 text-[11px] font-medium">
                        {k}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

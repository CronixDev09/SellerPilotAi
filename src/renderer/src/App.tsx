import React, { useState, useEffect } from 'react';
import { Sidebar, NavScreen } from './components/layout/Sidebar';
import { Header } from './components/layout/Header';
import { DashboardScreen } from './screens/DashboardScreen';
import { ProductsScreen } from './screens/ProductsScreen';
import { InventoryScreen } from './screens/InventoryScreen';
import { SalesScreen } from './screens/SalesScreen';
import { AnalyticsScreen } from './screens/AnalyticsScreen';
import { RestockPlannerScreen } from './screens/RestockPlannerScreen';
import { SuppliersScreen } from './screens/SuppliersScreen';
import { AiAssistantScreen } from './screens/AiAssistantScreen';
import { ReportsScreen } from './screens/ReportsScreen';
import { BackupRestoreScreen } from './screens/BackupRestoreScreen';
import { SettingsScreen } from './screens/SettingsScreen';
import { OnboardingWizard } from './components/onboarding/OnboardingWizard';
import {
  BusinessSettings,
  AiModelStatus,
  DashboardMetrics,
} from '../../shared/types';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

export const App: React.FC = () => {
  const [currentScreen, setCurrentScreen] = useState<NavScreen>('dashboard');
  const [settings, setSettings] = useState<BusinessSettings | null>(null);
  const [aiStatus, setAiStatus] = useState<AiModelStatus | null>(null);
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [selectedPeriod, setSelectedPeriod] = useState<number>(30);
  const [loadingMetrics, setLoadingMetrics] = useState<boolean>(true);
  const [notification, setNotification] = useState<{
    msg: string;
    type: 'success' | 'error' | 'info';
  } | null>(null);

  const showNotify = (msg: string, type: 'success' | 'error' | 'info' = 'info') => {
    setNotification({ msg, type });
    setTimeout(() => {
      setNotification((curr) => (curr?.msg === msg ? null : curr));
    }, 4000);
  };

  const loadSettingsAndAi = async () => {
    try {
      const [s, ai] = await Promise.all([
        window.sellerPilot.getSettings(),
        window.sellerPilot.checkAiHealth(),
      ]);
      setSettings(s);
      setAiStatus(ai);
    } catch (err) {
      console.error('Failed to initialize settings and AI status', err);
    }
  };

  const loadDashboard = async () => {
    try {
      setLoadingMetrics(true);
      const data = await window.sellerPilot.getDashboardMetrics(selectedPeriod);
      setMetrics(data);
    } catch (err) {
      console.error('Failed to load dashboard metrics', err);
    } finally {
      setLoadingMetrics(false);
    }
  };

  useEffect(() => {
    loadSettingsAndAi();
  }, []);

  useEffect(() => {
    loadDashboard();
  }, [selectedPeriod, currentScreen]);

  const handleUpdateSettings = async (newSettings: Partial<BusinessSettings>) => {
    const updated = await window.sellerPilot.updateSettings(newSettings);
    setSettings(updated);
  };

  const handleSeedDemo = async () => {
    await window.sellerPilot.seedDemoData();
    await loadSettingsAndAi();
    await loadDashboard();
    showNotify('Demonstration store loaded with sample products and sales', 'success');
  };

  const handleResetDemo = async () => {
    await window.sellerPilot.resetDemoData();
    await loadSettingsAndAi();
    await loadDashboard();
    showNotify('Store database cleared to clean slate', 'info');
  };

  const handleCompleteOnboarding = async (
    newSettings: Partial<BusinessSettings>,
    seedDemo: boolean
  ) => {
    await handleUpdateSettings(newSettings);
    if (seedDemo) {
      await window.sellerPilot.seedDemoData();
    }
    await loadSettingsAndAi();
    await loadDashboard();
    showNotify('Welcome to SellerPilot AI!', 'success');
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-50 font-sans">
      {/* 1. Left Sidebar Navigation */}
      <Sidebar
        currentScreen={currentScreen}
        onNavigate={setCurrentScreen}
        settings={settings}
        reorderAlertCount={metrics?.reorderRequiredCount}
      />

      {/* 2. Main Content Canvas */}
      <div className="flex-1 flex flex-col h-screen min-w-0 overflow-hidden">
        <Header
          settings={settings}
          aiStatus={aiStatus}
          selectedPeriod={selectedPeriod}
          onPeriodChange={setSelectedPeriod}
          reorderAlertCount={metrics?.reorderRequiredCount}
          onOpenRestock={() => setCurrentScreen('restock')}
          onOpenSettings={() => setCurrentScreen('settings')}
        />

        {/* Scrollable Screen Content */}
        <main className="flex-1 overflow-y-auto px-8 pt-6 pb-12">
          {currentScreen === 'dashboard' && (
            <DashboardScreen
              metrics={metrics}
              loading={loadingMetrics}
              onNavigate={setCurrentScreen}
              onSeedDemo={handleSeedDemo}
              selectedPeriod={selectedPeriod}
            />
          )}

          {currentScreen === 'products' && (
            <ProductsScreen onNotify={showNotify} onDataChanged={loadDashboard} />
          )}

          {currentScreen === 'inventory' && (
            <InventoryScreen onNotify={showNotify} onDataChanged={loadDashboard} />
          )}

          {currentScreen === 'sales' && (
            <SalesScreen onNotify={showNotify} onDataChanged={loadDashboard} />
          )}

          {currentScreen === 'analytics' && (
            <AnalyticsScreen
              onNotify={showNotify}
              selectedPeriod={selectedPeriod}
            />
          )}

          {currentScreen === 'restock' && (
            <RestockPlannerScreen onNotify={showNotify} />
          )}

          {currentScreen === 'suppliers' && (
            <SuppliersScreen onNotify={showNotify} />
          )}

          {currentScreen === 'ai' && (
            <AiAssistantScreen
              aiStatus={aiStatus}
              onNotify={showNotify}
              onOpenSettings={() => setCurrentScreen('settings')}
            />
          )}

          {currentScreen === 'reports' && (
            <ReportsScreen settings={settings} onNotify={showNotify} />
          )}

          {currentScreen === 'backup' && (
            <BackupRestoreScreen
              onNotify={showNotify}
              onRefreshAll={() => {
                loadSettingsAndAi();
                loadDashboard();
              }}
            />
          )}

          {currentScreen === 'settings' && (
            <SettingsScreen
              settings={settings}
              aiStatus={aiStatus}
              onUpdateSettings={handleUpdateSettings}
              onSeedDemo={handleSeedDemo}
              onResetDemo={handleResetDemo}
              onNotify={showNotify}
              onRefreshAi={loadSettingsAndAi}
            />
          )}
        </main>
      </div>

      {/* 3. Onboarding Wizard on First Launch */}
      {settings && !settings.isOnboarded && (
        <OnboardingWizard
          aiStatus={aiStatus}
          onComplete={handleCompleteOnboarding}
        />
      )}

      {/* 4. Global Notification Toast */}
      {notification && (
        <div
          className={`fixed bottom-6 right-6 z-50 px-4 py-3 rounded-xl shadow-xl border text-xs font-semibold flex items-center gap-3 transition-all animate-in fade-in slide-in-from-bottom-3 duration-200 ${
            notification.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : notification.type === 'error'
              ? 'bg-rose-50 border-rose-200 text-rose-900'
              : 'bg-slate-900 border-slate-800 text-white'
          }`}
        >
          {notification.type === 'success' && (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          )}
          {notification.type === 'error' && (
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          )}
          {notification.type === 'info' && (
            <Info className="w-4 h-4 text-blue-400 shrink-0" />
          )}
          <span>{notification.msg}</span>
          <button
            onClick={() => setNotification(null)}
            className="text-slate-400 hover:text-slate-600 p-0.5 ml-2"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
};

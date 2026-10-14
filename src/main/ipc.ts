import { ipcMain, dialog, BrowserWindow } from 'electron';
import { AppDatabase } from './db/database';
import { InventoryService } from './services/inventoryService';
import { SalesService } from './services/salesService';
import { AnalyticsService } from './services/analyticsService';
import { RestockService } from './services/restockService';
import { SupplierService } from './services/supplierService';
import { AiService } from './services/aiService';
import { DemoDataService } from './services/demoDataService';
import * as fs from 'fs';
import * as path from 'path';

export function registerIpcHandlers(db: AppDatabase, mainWindow: BrowserWindow) {
  const inventoryService = new InventoryService(db);
  const salesService = new SalesService(db);
  const analyticsService = new AnalyticsService(db);
  const restockService = new RestockService(db);
  const supplierService = new SupplierService(db);
  const aiService = new AiService(db);
  const demoDataService = new DemoDataService(db);

  // Business Settings
  ipcMain.handle('settings:get', async () => {
    const row = db.get<any>('SELECT * FROM business_settings WHERE id = 1;');
    if (!row) return null;
    return {
      id: row.id,
      businessName: row.business_name,
      businessType: row.business_type,
      currency: row.currency,
      country: row.country,
      language: row.language,
      logoData: row.logo_data,
      isOnboarded: Boolean(row.is_onboarded),
      demoMode: Boolean(row.demo_mode),
      targetStockCoverageDays: row.target_stock_coverage_days,
      warningThresholdDays: row.warning_threshold_days,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  });

  ipcMain.handle('settings:update', async (_, input: any) => {
    const now = new Date().toISOString();
    db.run(
      `UPDATE business_settings SET
        business_name = COALESCE(?, business_name),
        business_type = COALESCE(?, business_type),
        currency = COALESCE(?, currency),
        country = COALESCE(?, country),
        language = COALESCE(?, language),
        logo_data = COALESCE(?, logo_data),
        is_onboarded = COALESCE(?, is_onboarded),
        demo_mode = COALESCE(?, demo_mode),
        target_stock_coverage_days = COALESCE(?, target_stock_coverage_days),
        warning_threshold_days = COALESCE(?, warning_threshold_days),
        updated_at = ?
      WHERE id = 1;`,
      [
        input.businessName,
        input.businessType,
        input.currency,
        input.country,
        input.language,
        input.logoData,
        input.isOnboarded !== undefined ? (input.isOnboarded ? 1 : 0) : null,
        input.demoMode !== undefined ? (input.demoMode ? 1 : 0) : null,
        input.targetStockCoverageDays,
        input.warningThresholdDays,
        now,
      ]
    );
    const row = db.get<any>('SELECT * FROM business_settings WHERE id = 1;');
    return {
      id: row.id,
      businessName: row.business_name,
      businessType: row.business_type,
      currency: row.currency,
      country: row.country,
      language: row.language,
      logoData: row.logo_data,
      isOnboarded: Boolean(row.is_onboarded),
      demoMode: Boolean(row.demo_mode),
      targetStockCoverageDays: row.target_stock_coverage_days,
      warningThresholdDays: row.warning_threshold_days,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  });

  // Categories
  ipcMain.handle('categories:get', async () => {
    return inventoryService.getCategories();
  });

  ipcMain.handle('categories:add', async (_, { name, color }: { name: string; color?: string }) => {
    return inventoryService.addCategory(name, color);
  });

  // Products
  ipcMain.handle('products:get', async (_, options) => {
    return inventoryService.getProducts(options);
  });

  ipcMain.handle('products:getById', async (_, id: number) => {
    return inventoryService.getProductById(id);
  });

  ipcMain.handle('products:create', async (_, input) => {
    return inventoryService.createProduct(input);
  });

  ipcMain.handle('products:update', async (_, { id, input }) => {
    return inventoryService.updateProduct(id, input);
  });

  ipcMain.handle('products:archive', async (_, { id, archive }) => {
    inventoryService.archiveProduct(id, archive);
    return true;
  });

  ipcMain.handle('products:adjustStock', async (_, { productId, quantityDelta, movementType, reference, notes }) => {
    return inventoryService.adjustStock(productId, quantityDelta, movementType, reference, notes);
  });

  ipcMain.handle('products:getMovements', async (_, options) => {
    return inventoryService.getStockMovements(options);
  });

  ipcMain.handle('products:validateCsv', async (_, csvText: string) => {
    return inventoryService.validateProductsFromCsv(csvText);
  });

  ipcMain.handle('products:importCsv', async (_, csvText: string) => {
    return inventoryService.importProductsFromCsv(csvText);
  });

  ipcMain.handle('products:exportCsv', async () => {
    return inventoryService.exportProductsToCsv();
  });

  // Sales
  ipcMain.handle('sales:get', async (_, options) => {
    return salesService.getSales(options);
  });

  ipcMain.handle('sales:getById', async (_, id: number) => {
    return salesService.getSaleById(id);
  });

  ipcMain.handle('sales:record', async (_, input) => {
    return salesService.recordSale(input);
  });

  ipcMain.handle('sales:cancel', async (_, { saleId, reason }) => {
    return salesService.cancelSale(saleId, reason);
  });

  ipcMain.handle('sales:exportCsv', async () => {
    return salesService.exportSalesToCsv();
  });

  // Analytics & Dashboard
  ipcMain.handle('analytics:dashboard', async (_, periodDays: number) => {
    return analyticsService.getDashboardMetrics(periodDays);
  });

  ipcMain.handle('analytics:sales', async (_, periodDays: number) => {
    return analyticsService.getSalesAnalytics(periodDays);
  });

  // Restock Planner
  ipcMain.handle('restock:getRecommendations', async (_, options) => {
    return restockService.getRestockRecommendations(options);
  });

  ipcMain.handle('restock:exportCsv', async () => {
    return restockService.exportRestockToCsv();
  });

  // Suppliers
  ipcMain.handle('suppliers:get', async () => {
    return supplierService.getSuppliers();
  });

  ipcMain.handle('suppliers:getById', async (_, id: number) => {
    return supplierService.getSupplierById(id);
  });

  ipcMain.handle('suppliers:create', async (_, input) => {
    return supplierService.createSupplier(input);
  });

  ipcMain.handle('suppliers:update', async (_, { id, input }) => {
    return supplierService.updateSupplier(id, input);
  });

  // Local AI
  ipcMain.handle('ai:checkHealth', async () => {
    return aiService.checkHealth();
  });

  ipcMain.handle('ai:generateListing', async (_, input) => {
    return aiService.generateProductListing(input);
  });

  ipcMain.handle('ai:getInsights', async (_, question: string) => {
    return aiService.getBusinessInsights(question);
  });

  ipcMain.handle('ai:setConfig', async (_, { endpoint, model }) => {
    if (endpoint) aiService.setEndpoint(endpoint);
    if (model) aiService.setSelectedModel(model);
    return aiService.checkHealth();
  });

  // Demonstration Data
  ipcMain.handle('demo:seed', async () => {
    demoDataService.seedDemoData();
    return true;
  });

  ipcMain.handle('demo:reset', async () => {
    demoDataService.resetDemoData();
    return true;
  });

  // Backup and Restore
  ipcMain.handle('backup:create', async (_, customDir?: string) => {
    const backupDir = customDir || path.join(path.dirname(db.getDbPath()), 'backups');
    return db.exportBackup(backupDir);
  });

  ipcMain.handle('backup:restore', async (_, backupFilePath: string) => {
    return db.restoreFromBackup(backupFilePath);
  });

  ipcMain.handle('backup:getHistory', async () => {
    return db.all<any>('SELECT * FROM backup_history ORDER BY created_at DESC LIMIT 20;');
  });

  ipcMain.handle('backup:getDbInfo', async () => {
    const dbPath = db.getDbPath();
    let sizeBytes = 0;
    if (fs.existsSync(dbPath)) {
      sizeBytes = fs.statSync(dbPath).size;
    }
    return {
      dbPath,
      sizeBytes,
      integrityOk: db.checkIntegrity(),
    };
  });

  // File Dialog Helpers
  ipcMain.handle('dialog:openFile', async (_, options) => {
    const res = await dialog.showOpenDialog(mainWindow, options);
    if (res.canceled || res.filePaths.length === 0) return null;
    const filePath = res.filePaths[0];
    const content = fs.readFileSync(filePath, 'utf8');
    return { filePath, content };
  });

  ipcMain.handle('dialog:saveFile', async (_, { defaultName, content, filters }) => {
    const res = await dialog.showSaveDialog(mainWindow, {
      defaultPath: defaultName,
      filters: filters || [{ name: 'All Files', extensions: ['*'] }],
    });
    if (res.canceled || !res.filePath) return null;
    fs.writeFileSync(res.filePath, content, 'utf8');
    if (!fs.existsSync(res.filePath)) {
      throw new Error(`Failed to confirm file was written to "${res.filePath}"`);
    }
    return res.filePath;
  });

  ipcMain.handle('dialog:selectDirectory', async () => {
    const res = await dialog.showOpenDialog(mainWindow, {
      properties: ['openDirectory', 'createDirectory'],
    });
    if (res.canceled || res.filePaths.length === 0) return null;
    return res.filePaths[0];
  });
}

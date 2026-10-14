// SQLite schema definitions and versioned migrations for SellerPilot AI

export interface Migration {
  version: number;
  name: string;
  up: string;
}

export const MIGRATIONS: Migration[] = [
  {
    version: 1,
    name: 'initial_schema',
    up: `
      -- Schema migrations tracker
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        applied_at TEXT NOT NULL
      );

      -- Business Settings (singleton row id = 1)
      CREATE TABLE IF NOT EXISTS business_settings (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        business_name TEXT NOT NULL DEFAULT 'My Store',
        business_type TEXT NOT NULL DEFAULT 'Retail',
        currency TEXT NOT NULL DEFAULT 'INR',
        country TEXT NOT NULL DEFAULT 'India',
        language TEXT NOT NULL DEFAULT 'en',
        logo_data TEXT,
        is_onboarded INTEGER NOT NULL DEFAULT 0,
        demo_mode INTEGER NOT NULL DEFAULT 0,
        target_stock_coverage_days INTEGER NOT NULL DEFAULT 30,
        warning_threshold_days INTEGER NOT NULL DEFAULT 7,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      -- Categories
      CREATE TABLE IF NOT EXISTS categories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE NOT NULL COLLATE NOCASE,
        color TEXT DEFAULT '#3B82F6',
        created_at TEXT NOT NULL
      );

      -- Suppliers
      CREATE TABLE IF NOT EXISTS suppliers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        contact_person TEXT,
        phone TEXT,
        email TEXT,
        address TEXT,
        lead_time_days INTEGER NOT NULL DEFAULT 7,
        min_order_qty INTEGER NOT NULL DEFAULT 1,
        notes TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      -- Products Catalog
      CREATE TABLE IF NOT EXISTS products (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        sku TEXT UNIQUE NOT NULL COLLATE NOCASE,
        name TEXT NOT NULL,
        category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
        description TEXT,
        brand TEXT,
        barcode TEXT,
        unit TEXT NOT NULL DEFAULT 'pcs',
        purchase_cost_paise INTEGER NOT NULL DEFAULT 0,
        selling_price_paise INTEGER NOT NULL DEFAULT 0,
        current_stock REAL NOT NULL DEFAULT 0,
        min_stock_threshold REAL NOT NULL DEFAULT 5,
        safety_stock REAL NOT NULL DEFAULT 5,
        supplier_id INTEGER REFERENCES suppliers(id) ON DELETE SET NULL,
        supplier_lead_time_days INTEGER NOT NULL DEFAULT 7,
        is_archived INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      -- Sales Records
      CREATE TABLE IF NOT EXISTS sales (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        sale_reference TEXT UNIQUE NOT NULL,
        sale_date TEXT NOT NULL,
        total_amount_paise INTEGER NOT NULL,
        discount_paise INTEGER NOT NULL DEFAULT 0,
        final_amount_paise INTEGER NOT NULL,
        payment_method TEXT NOT NULL DEFAULT 'CASH',
        notes TEXT,
        status TEXT NOT NULL DEFAULT 'completed', -- completed, cancelled
        cancelled_at TEXT,
        cancellation_reason TEXT,
        created_at TEXT NOT NULL
      );

      -- Sale Line Items
      CREATE TABLE IF NOT EXISTS sale_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        sale_id INTEGER NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
        product_id INTEGER NOT NULL REFERENCES products(id),
        quantity REAL NOT NULL,
        unit_selling_price_paise INTEGER NOT NULL,
        unit_cost_paise INTEGER NOT NULL,
        discount_paise INTEGER NOT NULL DEFAULT 0,
        total_amount_paise INTEGER NOT NULL
      );

      -- Stock Movements (audit trail)
      CREATE TABLE IF NOT EXISTS stock_movements (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        product_id INTEGER NOT NULL REFERENCES products(id),
        movement_type TEXT NOT NULL,
        quantity REAL NOT NULL,
        reference TEXT,
        notes TEXT,
        timestamp TEXT NOT NULL
      );

      -- Backup History
      CREATE TABLE IF NOT EXISTS backup_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        filename TEXT NOT NULL,
        file_path TEXT NOT NULL,
        file_size_bytes INTEGER,
        status TEXT NOT NULL,
        created_at TEXT NOT NULL
      );

      -- Performance Indexes
      CREATE INDEX IF NOT EXISTS idx_products_sku ON products(sku);
      CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);
      CREATE INDEX IF NOT EXISTS idx_products_supplier ON products(supplier_id);
      CREATE INDEX IF NOT EXISTS idx_products_archived ON products(is_archived);
      CREATE INDEX IF NOT EXISTS idx_sales_date ON sales(sale_date);
      CREATE INDEX IF NOT EXISTS idx_sales_reference ON sales(sale_reference);
      CREATE INDEX IF NOT EXISTS idx_sale_items_sale ON sale_items(sale_id);
      CREATE INDEX IF NOT EXISTS idx_sale_items_product ON sale_items(product_id);
      CREATE INDEX IF NOT EXISTS idx_movements_product ON stock_movements(product_id);
      CREATE INDEX IF NOT EXISTS idx_movements_timestamp ON stock_movements(timestamp);
    `,
  },
];

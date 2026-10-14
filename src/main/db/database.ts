import initSqlJs, { Database as SqlDatabase } from 'sql.js';
import * as fs from 'fs';
import * as path from 'path';
import { MIGRATIONS } from './migrations';

export class AppDatabase {
  private db: SqlDatabase | null = null;
  private dbPath: string;
  private isDirty: boolean = false;
  private saveTimeout: NodeJS.Timeout | null = null;

  constructor(customPath?: string) {
    if (customPath) {
      this.dbPath = customPath;
    } else {
      // In electron, can be injected or default to app data
      const baseDir = process.env.SELLERPILOT_DATA_DIR || path.join(process.cwd(), 'data');
      if (!fs.existsSync(baseDir)) {
        fs.mkdirSync(baseDir, { recursive: true });
      }
      this.dbPath = path.join(baseDir, 'sellerpilot.db');
    }
  }

  public getDbPath(): string {
    return this.dbPath;
  }

  public async init(): Promise<void> {
    const SQL = await initSqlJs();
    const dir = path.dirname(this.dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    if (fs.existsSync(this.dbPath)) {
      const fileBuffer = fs.readFileSync(this.dbPath);
      this.db = new SQL.Database(fileBuffer);
    } else {
      this.db = new SQL.Database();
      this.saveImmediate();
    }

    // Enable foreign keys
    this.exec('PRAGMA foreign_keys = ON;');

    // Run migrations
    this.runMigrations();

    // Ensure default settings row exists
    this.ensureDefaultSettings();
  }

  public saveImmediate(): void {
    if (!this.db) return;
    const data = this.db.export();
    const buffer = Buffer.from(data);
    const dir = path.dirname(this.dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    const tempPath = `${this.dbPath}.tmp`;
    fs.writeFileSync(tempPath, buffer);
    fs.renameSync(tempPath, this.dbPath);
    this.isDirty = false;
  }

  public markDirty(): void {
    this.isDirty = true;
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
    }
    // Debounce save by 200ms for high performance
    this.saveTimeout = setTimeout(() => {
      this.saveImmediate();
      this.saveTimeout = null;
    }, 200);
  }

  public exec(sql: string): void {
    if (!this.db) throw new Error('Database not initialized');
    this.db.exec(sql);
    this.markDirty();
  }

  public run(sql: string, params: any[] = []): { lastInsertRowid: number; changes: number } {
    if (!this.db) throw new Error('Database not initialized');
    this.db.run(sql, params);
    const res = this.db.exec('SELECT last_insert_rowid() AS id, changes() AS changes;');
    this.markDirty();
    const id = res[0]?.values[0]?.[0] as number || 0;
    const changes = res[0]?.values[0]?.[1] as number || 0;
    return { lastInsertRowid: id, changes };
  }

  public get<T = any>(sql: string, params: any[] = []): T | null {
    if (!this.db) throw new Error('Database not initialized');
    const stmt = this.db.prepare(sql);
    try {
      stmt.bind(params);
      if (stmt.step()) {
        const row = stmt.getAsObject() as unknown as T;
        return row;
      }
      return null;
    } finally {
      stmt.free();
    }
  }

  public all<T = any>(sql: string, params: any[] = []): T[] {
    if (!this.db) throw new Error('Database not initialized');
    const stmt = this.db.prepare(sql);
    const results: T[] = [];
    try {
      stmt.bind(params);
      while (stmt.step()) {
        results.push(stmt.getAsObject() as unknown as T);
      }
      return results;
    } finally {
      stmt.free();
    }
  }

  public transaction<T>(callback: () => T): T {
    if (!this.db) throw new Error('Database not initialized');
    this.db.exec('BEGIN TRANSACTION;');
    try {
      const result = callback();
      this.db.exec('COMMIT;');
      this.markDirty();
      return result;
    } catch (err) {
      this.db.exec('ROLLBACK;');
      throw err;
    }
  }

  private runMigrations(): void {
    if (!this.db) return;
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        applied_at TEXT NOT NULL
      );
    `);

    const appliedRows = this.all<{ version: number }>('SELECT version FROM schema_migrations ORDER BY version ASC;');
    const appliedVersions = new Set(appliedRows.map(r => r.version));

    for (const migration of MIGRATIONS) {
      if (!appliedVersions.has(migration.version)) {
        console.log(`Applying migration ${migration.version}: ${migration.name}`);
        this.transaction(() => {
          this.exec(migration.up);
          this.run(
            'INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?);',
            [migration.version, migration.name, new Date().toISOString()]
          );
        });
      }
    }
  }

  private ensureDefaultSettings(): void {
    const existing = this.get('SELECT id FROM business_settings WHERE id = 1;');
    if (!existing) {
      const now = new Date().toISOString();
      this.run(
        `INSERT INTO business_settings (
          id, business_name, business_type, currency, country, language, 
          is_onboarded, demo_mode, target_stock_coverage_days, warning_threshold_days, 
          created_at, updated_at
        ) VALUES (1, ?, ?, ?, ?, ?, 0, 0, 30, 7, ?, ?);`,
        ['My Store', 'Retail & Electronics', 'INR', 'India', 'en', now, now]
      );
    }
  }

  public checkIntegrity(): boolean {
    if (!this.db) return false;
    const res = this.get<{ integrity_check: string }>('PRAGMA integrity_check;');
    return res?.integrity_check === 'ok';
  }

  public exportBackup(backupDir: string): { filename: string; filePath: string; size: number } {
    if (!this.db) throw new Error('Database not initialized');
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `sellerpilot_backup_${timestamp}.db`;
    const targetPath = path.join(backupDir, filename);

    // Make sure latest state is exported
    const data = this.db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(targetPath, buffer);

    this.run(
      'INSERT INTO backup_history (filename, file_path, file_size_bytes, status, created_at) VALUES (?, ?, ?, ?, ?);',
      [filename, targetPath, buffer.length, 'success', new Date().toISOString()]
    );

    return { filename, filePath: targetPath, size: buffer.length };
  }

  public async restoreFromBackup(backupFilePath: string): Promise<boolean> {
    if (!fs.existsSync(backupFilePath)) {
      throw new Error('Backup file does not exist');
    }

    // 1. Validate file header (SQLite file starts with "SQLite format 3\000")
    const header = Buffer.alloc(16);
    const fd = fs.openSync(backupFilePath, 'r');
    fs.readSync(fd, header, 0, 16, 0);
    fs.closeSync(fd);
    const headerStr = header.toString('utf8');
    if (!headerStr.startsWith('SQLite format 3')) {
      throw new Error('Invalid backup file: Not a valid SQLite database.');
    }

    // 2. Create recovery backup of current database first
    const recoveryDir = path.join(path.dirname(this.dbPath), 'recovery_snapshots');
    if (!fs.existsSync(recoveryDir)) {
      fs.mkdirSync(recoveryDir, { recursive: true });
    }
    const recTimestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const recoveryPath = path.join(recoveryDir, `recovery_pre_restore_${recTimestamp}.db`);
    if (this.db) {
      fs.writeFileSync(recoveryPath, Buffer.from(this.db.export()));
    }

    // 3. Load the new database
    const SQL = await initSqlJs();
    const newBuffer = fs.readFileSync(backupFilePath);
    const candidateDb = new SQL.Database(newBuffer);

    // Verify integrity of candidate
    const checkStmt = candidateDb.prepare('PRAGMA integrity_check;');
    let isOk = false;
    if (checkStmt.step()) {
      const obj = checkStmt.getAsObject() as { integrity_check?: string };
      isOk = obj.integrity_check === 'ok';
    }
    checkStmt.free();

    if (!isOk) {
      candidateDb.close();
      throw new Error('Integrity check failed on candidate backup file.');
    }

    // Replace in-memory database and persist to disk
    if (this.db) {
      this.db.close();
    }
    this.db = candidateDb;
    this.saveImmediate();

    this.run(
      'INSERT INTO backup_history (filename, file_path, file_size_bytes, status, created_at) VALUES (?, ?, ?, ?, ?);',
      [path.basename(backupFilePath), backupFilePath, newBuffer.length, 'restored', new Date().toISOString()]
    );

    return true;
  }

  public close(): void {
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
      this.saveTimeout = null;
    }
    if (this.db) {
      if (this.isDirty) {
        this.saveImmediate();
      }
      this.db.close();
      this.db = null;
    }
  }
}

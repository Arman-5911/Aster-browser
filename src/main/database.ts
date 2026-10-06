import {aiConfigSchema,learningSchema,type AIConfig,type Learning} from '../shared/ai';
import { DatabaseSync } from 'node:sqlite';
import { randomUUID } from 'node:crypto';
import { settingsSchema, type Settings } from '../shared/schema';
import type { Bookmark, HistoryEntry, Download } from '../shared/types';
import { checkpointSchema, windowSessionSchema, type Checkpoint, type WindowSession } from '../shared/workspace';
import {permissionSchema,permissionValueSchema,type SitePermission,type PermissionValue} from '../shared/privacy';
import type {Note,ReadingItem} from '../shared/productivity';
export class Repository {
  private db: DatabaseSync;
  private cachedPrivacy?:Pick<Settings,'protection'|'aiSiteCompatibility'>;
  privacySettings(){if(!this.cachedPrivacy){const s=this.settings();this.cachedPrivacy={protection:s.protection,aiSiteCompatibility:s.aiSiteCompatibility};}return this.cachedPrivacy;}
  constructor(path: string) {
    this.db = new DatabaseSync(path);
    this.db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;
      CREATE TABLE IF NOT EXISTS schema_migrations(version INTEGER PRIMARY KEY, applied_at INTEGER NOT NULL);`);
    if (!this.db.prepare('SELECT version FROM schema_migrations WHERE version=1').get()) {
      this.db.exec(`BEGIN;
        CREATE TABLE settings(key TEXT PRIMARY KEY, value TEXT NOT NULL);
        CREATE TABLE bookmarks(id TEXT PRIMARY KEY, title TEXT NOT NULL, url TEXT NOT NULL UNIQUE, created_at INTEGER NOT NULL);
        CREATE TABLE history(id TEXT PRIMARY KEY, title TEXT NOT NULL, url TEXT NOT NULL, visited_at INTEGER NOT NULL);
        CREATE INDEX history_time ON history(visited_at DESC);
        CREATE TABLE downloads(id TEXT PRIMARY KEY, filename TEXT NOT NULL, url TEXT NOT NULL, path TEXT NOT NULL, received INTEGER NOT NULL, total INTEGER NOT NULL, state TEXT NOT NULL, started_at INTEGER NOT NULL);
        INSERT INTO schema_migrations VALUES(1, unixepoch()*1000); COMMIT;`);
    }
    if (!this.db.prepare('SELECT version FROM schema_migrations WHERE version=2').get()) {
      this.db.exec(`BEGIN;
        ALTER TABLE bookmarks RENAME TO bookmarks_v1;
        CREATE TABLE bookmarks(id TEXT PRIMARY KEY,title TEXT NOT NULL,url TEXT NOT NULL,created_at INTEGER NOT NULL,workspace_id TEXT NOT NULL DEFAULT 'default',UNIQUE(workspace_id,url));
        INSERT INTO bookmarks SELECT *, 'default' FROM bookmarks_v1;
        DROP TABLE bookmarks_v1;
        ALTER TABLE history ADD COLUMN workspace_id TEXT NOT NULL DEFAULT 'default';
        CREATE INDEX history_workspace_time ON history(workspace_id,visited_at DESC);
        CREATE TABLE sessions(id TEXT PRIMARY KEY,name TEXT NOT NULL,data TEXT NOT NULL,updated_at INTEGER NOT NULL);
        CREATE TABLE checkpoints(id INTEGER PRIMARY KEY CHECK(id=1),data TEXT NOT NULL);
        INSERT INTO schema_migrations VALUES(2,unixepoch()*1000); COMMIT;`);
    }
    if(!this.db.prepare('SELECT version FROM schema_migrations WHERE version=3').get())this.db.exec(`BEGIN;
      CREATE TABLE site_permissions(scope TEXT NOT NULL,origin TEXT NOT NULL,permission TEXT NOT NULL,value TEXT NOT NULL,PRIMARY KEY(scope,origin,permission));
      CREATE TABLE site_exceptions(scope TEXT NOT NULL,origin TEXT NOT NULL,PRIMARY KEY(scope,origin));
      INSERT INTO schema_migrations VALUES(3,unixepoch()*1000);COMMIT;`);
    if(!this.db.prepare('SELECT version FROM schema_migrations WHERE version=4').get())this.db.exec(`BEGIN;
      CREATE TABLE notes(id TEXT PRIMARY KEY,workspace_id TEXT NOT NULL,title TEXT NOT NULL,body TEXT NOT NULL,updated_at INTEGER NOT NULL);
      CREATE INDEX notes_workspace ON notes(workspace_id,updated_at DESC);
      CREATE TABLE reading_list(id TEXT PRIMARY KEY,workspace_id TEXT NOT NULL,title TEXT NOT NULL,url TEXT NOT NULL,is_read INTEGER NOT NULL DEFAULT 0,created_at INTEGER NOT NULL,UNIQUE(workspace_id,url));
      INSERT INTO schema_migrations VALUES(4,unixepoch()*1000);COMMIT;`);
    if(!this.db.prepare('SELECT version FROM schema_migrations WHERE version=5').get())this.db.exec(`BEGIN;
      CREATE TABLE learning(workspace_id TEXT PRIMARY KEY,data TEXT NOT NULL);
      CREATE TABLE ai_cache(workspace_id TEXT NOT NULL,signature TEXT NOT NULL,answer TEXT NOT NULL,created_at INTEGER NOT NULL,PRIMARY KEY(workspace_id,signature));
      INSERT INTO schema_migrations VALUES(5,unixepoch()*1000);COMMIT;`);
    this.db.exec("UPDATE downloads SET state='interrupted' WHERE state IN ('progressing','paused')");
  }
  settings(): Settings {
    const row = this.db.prepare("SELECT value FROM settings WHERE key='preferences'").get();
    try { return settingsSchema.parse(row ? JSON.parse(String(row.value)) : {}); } catch { return settingsSchema.parse({}); }
  }
  setSettings(value: Settings) { this.db.prepare("INSERT OR REPLACE INTO settings VALUES('preferences', ?)").run(JSON.stringify(settingsSchema.parse(value)));this.cachedPrivacy=undefined; }
  bookmarks(workspaceId='default'): Bookmark[] { return this.db.prepare('SELECT * FROM bookmarks WHERE workspace_id=? ORDER BY created_at DESC LIMIT 500').all(workspaceId) as unknown as Bookmark[]; }
  bookmark(title: string, url: string, workspaceId='default') { this.db.prepare('INSERT INTO bookmarks VALUES(?,?,?,?,?) ON CONFLICT(workspace_id,url) DO UPDATE SET title=excluded.title').run(randomUUID(),title.slice(0,500),url,Date.now(),workspaceId); }
  removeBookmark(id: string,workspaceId='default') { this.db.prepare('DELETE FROM bookmarks WHERE id=? AND workspace_id=?').run(id,workspaceId); }
  history(query = '',workspaceId='default'): HistoryEntry[] { return this.db.prepare('SELECT * FROM history WHERE workspace_id=? AND (title LIKE ? OR url LIKE ?) ORDER BY visited_at DESC LIMIT 300').all(workspaceId,`%${query}%`, `%${query}%`) as unknown as HistoryEntry[]; }
  visit(title: string, url: string,workspaceId='default') { this.db.prepare('INSERT INTO history VALUES(?,?,?,?,?)').run(randomUUID(),title.slice(0,500),url,Date.now(),workspaceId); }
  clearHistory(workspaceId='default') { this.db.prepare('DELETE FROM history WHERE workspace_id=?').run(workspaceId); }
  sessions():{id:string;name:string;updated_at:number}[]{return this.db.prepare('SELECT id,name,updated_at FROM sessions ORDER BY updated_at DESC LIMIT 100').all() as unknown as {id:string;name:string;updated_at:number}[];}
  saveSession(name:string,data:WindowSession){if(this.sessions().length>=100)throw new Error('The prototype supports up to 100 saved sessions.');this.db.prepare('INSERT INTO sessions VALUES(?,?,?,?)').run(randomUUID(),name,JSON.stringify(windowSessionSchema.parse(data)),Date.now());}
  loadSession(id:string):WindowSession|undefined{const row=this.db.prepare('SELECT data FROM sessions WHERE id=?').get(id);if(!row)return;try{return windowSessionSchema.parse(JSON.parse(String(row.data)));}catch{return;}}
  deleteSession(id:string){this.db.prepare('DELETE FROM sessions WHERE id=?').run(id);}
  checkpoint():Checkpoint|undefined{const row=this.db.prepare('SELECT data FROM checkpoints WHERE id=1').get();if(!row)return;try{return checkpointSchema.parse(JSON.parse(String(row.data)));}catch{return;}}
  saveCheckpoint(value:Checkpoint){this.db.prepare('INSERT OR REPLACE INTO checkpoints VALUES(1,?)').run(JSON.stringify(checkpointSchema.parse(value)));}
  clearCheckpoint(){this.db.exec('DELETE FROM checkpoints');}
  downloads(): Download[] { return this.db.prepare('SELECT * FROM downloads ORDER BY started_at DESC LIMIT 200').all() as unknown as Download[]; }
  saveDownload(d: Download) { this.db.prepare('INSERT OR REPLACE INTO downloads VALUES(?,?,?,?,?,?,?,?)').run(d.id,d.filename,d.url,d.path,d.received,d.total,d.state,d.started_at); }
  permission(scope:string,origin:string,permission:SitePermission):PermissionValue|undefined{const row=this.db.prepare('SELECT value FROM site_permissions WHERE scope=? AND origin=? AND permission=?').get(scope,origin,permission);const parsed=permissionValueSchema.safeParse(row?.value);return parsed.success?parsed.data:undefined;}
  setPermission(scope:string,origin:string,permission:SitePermission,value:PermissionValue){this.db.prepare('INSERT OR REPLACE INTO site_permissions VALUES(?,?,?,?)').run(scope,origin,permissionSchema.parse(permission),permissionValueSchema.parse(value));}
  resetPermissions(scope:string,origin:string){this.db.prepare('DELETE FROM site_permissions WHERE scope=? AND origin=?').run(scope,origin);}
  exception(scope:string,origin:string){return !!this.db.prepare('SELECT 1 FROM site_exceptions WHERE scope=? AND origin=?').get(scope,origin);}
  setException(scope:string,origin:string,disabled:boolean){if(disabled)this.db.prepare('INSERT OR IGNORE INTO site_exceptions VALUES(?,?)').run(scope,origin);else this.db.prepare('DELETE FROM site_exceptions WHERE scope=? AND origin=?').run(scope,origin);}
  notes(scope:string):Note[]{return this.db.prepare('SELECT id,title,body,updated_at FROM notes WHERE workspace_id=? ORDER BY updated_at DESC LIMIT 200').all(scope) as unknown as Note[];}
  saveNote(scope:string,id:string|undefined,title:string,body:string){
    if(id){this.db.prepare('UPDATE notes SET title=?,body=?,updated_at=? WHERE id=? AND workspace_id=?').run(title,body,Date.now(),id,scope);return;}
    if(this.notes(scope).length>=200)throw new Error('The prototype supports up to 200 notes per workspace.');
    this.db.prepare('INSERT INTO notes VALUES(?,?,?,?,?)').run(randomUUID(),scope,title,body,Date.now());
  }
  deleteNote(scope:string,id:string){this.db.prepare('DELETE FROM notes WHERE id=? AND workspace_id=?').run(id,scope);}
  readingList(scope:string):ReadingItem[]{return this.db.prepare('SELECT id,title,url,is_read,created_at FROM reading_list WHERE workspace_id=? ORDER BY created_at DESC LIMIT 500').all(scope) as unknown as ReadingItem[];}
  addReading(scope:string,title:string,url:string){
    if(this.readingList(scope).length>=500&&!this.db.prepare('SELECT id FROM reading_list WHERE workspace_id=? AND url=?').get(scope,url))throw new Error('The prototype supports up to 500 reading-list entries per workspace.');
    this.db.prepare('INSERT INTO reading_list VALUES(?,?,?,?,0,?) ON CONFLICT(workspace_id,url) DO UPDATE SET title=excluded.title').run(randomUUID(),scope,title.slice(0,500),url,Date.now());
  }
  markReading(scope:string,id:string,read:boolean){this.db.prepare('UPDATE reading_list SET is_read=? WHERE id=? AND workspace_id=?').run(read?1:0,id,scope);}
  deleteReading(scope:string,id:string){this.db.prepare('DELETE FROM reading_list WHERE id=? AND workspace_id=?').run(id,scope);}
  aiConfig():AIConfig{try{const row=this.db.prepare("SELECT value FROM settings WHERE key='ai-provider'").get();return aiConfigSchema.parse(row?JSON.parse(String(row.value)):{});}catch{return aiConfigSchema.parse({});}}
  setAIConfig(value:AIConfig){this.db.prepare("INSERT OR REPLACE INTO settings VALUES('ai-provider',?)").run(JSON.stringify(aiConfigSchema.parse(value)));}
  learning(scope:string):Learning{try{const row=this.db.prepare('SELECT data FROM learning WHERE workspace_id=?').get(scope);return learningSchema.parse(row?JSON.parse(String(row.data)):{});}catch{return learningSchema.parse({});}}
  saveLearning(scope:string,value:Learning){this.db.prepare('INSERT OR REPLACE INTO learning VALUES(?,?)').run(scope,JSON.stringify(learningSchema.parse(value)));}
  aiCache(scope:string,signature:string):string|undefined{const row=this.db.prepare('SELECT answer FROM ai_cache WHERE workspace_id=? AND signature=?').get(scope,signature);return row?String(row.answer):undefined;}
  aiCacheCount(scope:string){return Number(this.db.prepare('SELECT COUNT(*) AS count FROM ai_cache WHERE workspace_id=?').get(scope)?.count??0);}
  saveAICache(scope:string,signature:string,answer:string){this.db.prepare('INSERT OR REPLACE INTO ai_cache VALUES(?,?,?,?)').run(scope,signature,answer,Date.now());this.db.prepare('DELETE FROM ai_cache WHERE workspace_id=? AND signature NOT IN (SELECT signature FROM ai_cache WHERE workspace_id=? ORDER BY created_at DESC LIMIT 20)').run(scope,scope);}
  clearAICache(scope:string){this.db.prepare('DELETE FROM ai_cache WHERE workspace_id=?').run(scope);}
  close() { this.db.close(); }
}

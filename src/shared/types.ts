import type {ExtensionSnapshot} from './extensions';
import type {AISnapshot} from './ai';
import type {VaultSnapshot} from './vault';
import type {DeveloperSnapshot} from './developer';
import type {Article} from './reader';
import type { Command, Settings } from './schema';
import type { WorkspaceInfo } from './workspace';
import type {PrivacySnapshot,PermissionPrompt} from './privacy';
import type {Note,ReadingItem} from './productivity';
export type Panel = 'none'|'history'|'bookmarks'|'downloads'|'settings'|'menu'|'security'|'organize'|'sessions'|'privacy'|'notes'|'reading'|'reader'|'palette'|'developer'|'vault'|'studio'|'dashboard'|'ai'|'research'|'study'|'extensions'|'performance';
export interface Tab { sleeping?:boolean; settingsOrigin?:string; id: string; title: string; url: string; loading: boolean; canGoBack: boolean; canGoForward: boolean; pinned: boolean; muted: boolean; error?: string; zoom: number; workspaceId:string; groupId:string|null; floating:boolean; alwaysOnTop:boolean }
export interface Bookmark { id: string; title: string; url: string; created_at: number }
export interface HistoryEntry { id: string; title: string; url: string; visited_at: number }
export interface Download { id: string; filename: string; url: string; path: string; received: number; total: number; state: string; started_at: number }
export interface Snapshot { performance:{processes:number;memoryMB:number;cpu:number;sampledAt:number}; extensions:ExtensionSnapshot; ai:AISnapshot; chromeHidden:boolean;sidebarCollapsed:boolean;system:{onBattery:boolean;memoryTotal:number;memoryFree:number;cpuCount:number}; tabs: Tab[]; activeId: string; panel: Panel; settings: Settings; bookmarks: Bookmark[]; history: HistoryEntry[]; downloads: Download[]; platform: string; workspaces:WorkspaceInfo[]; activeWorkspaceId:string; sessions:{id:string;name:string;updated_at:number}[]; recoveryPending:boolean;privacy:PrivacySnapshot;permissionPrompts:PermissionPrompt[];notes:Note[];readingList:ReadingItem[];article?:Article;developer:DeveloperSnapshot;vault:VaultSnapshot }
export interface Bridge { snapshot(): Promise<Snapshot>; command(command: Command): Promise<{ok: boolean; error?: string}>; subscribe(listener: (state: Snapshot) => void): () => void; onShortcut(listener: (action: string) => void): () => void }
declare global { interface Window { aster: Bridge } }

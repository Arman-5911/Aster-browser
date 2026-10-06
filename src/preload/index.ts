import { contextBridge, ipcRenderer } from 'electron';
import type { Bridge, Snapshot } from '../shared/types';
const bridge: Bridge = {
  snapshot: () => ipcRenderer.invoke('aster:snapshot'),
  command: command => ipcRenderer.invoke('aster:command', command),
  subscribe: listener => { const handler = (_event: unknown, state: Snapshot) => listener(state); ipcRenderer.on('aster:state', handler); return () => ipcRenderer.removeListener('aster:state', handler); },
  onShortcut: listener => { const handler = (_event: unknown, action: string) => listener(action); ipcRenderer.on('aster:shortcut', handler); return () => ipcRenderer.removeListener('aster:shortcut', handler); }
};
contextBridge.exposeInMainWorld('aster', bridge);

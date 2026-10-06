import { create } from 'zustand';
import type { Snapshot } from '../shared/types';
import type { Command } from '../shared/schema';
export const useBrowser = create<{ state?: Snapshot; error: string; setState: (state:Snapshot)=>void; setError:(error:string)=>void }>(set=>({error:'',setState:state=>set({state}),setError:error=>set({error})}));
export async function send(command: Command) {
  try {const result=await window.aster.command(command); if(!result.ok) useBrowser.getState().setError(result.error??'Action failed.'); return result.ok;}
  catch {useBrowser.getState().setError('The browser connection was interrupted. Restart Aster to reconnect.');return false;}
}

import { z } from 'zod';
import { isWebUrl,settingsPanel } from './navigation';

export const entityId = z.string().regex(/^[a-zA-Z0-9-]{1,100}$/);
export const colorSchema = z.enum(['forest', 'slate', 'clay', 'lavender']);
export const splitSchema = z.object({
  mode: z.enum(['off', 'columns', 'rows', 'three', 'grid']),
  tabs: z.array(entityId).max(4), x: z.number().min(.2).max(.8), y: z.number().min(.2).max(.8)
}).strict();
export const groupSchema = z.object({ id: entityId, name: z.string().trim().min(1).max(60), color: colorSchema, icon: z.enum(['folder','code','book','star']), collapsed: z.boolean() }).strict();
export const savedTabSchema = z.object({
  id: entityId, title: z.string().max(500), url: z.string().max(8192).refine(v=>v==='aster://newtab'||!!settingsPanel(v)||isWebUrl(v)),
  pinned: z.boolean(), muted: z.boolean(), zoom: z.number().min(.3).max(3), groupId: entityId.nullable()
}).strict();
export const workspaceSchema = z.object({
  id: entityId, name: z.string().trim().min(1).max(60), color: colorSchema,
  theme: z.enum(['inherit','light','dark','system']), recordHistory: z.boolean(),
  activeId: entityId, groups: z.array(groupSchema).max(50), tabs: z.array(savedTabSchema).min(1).max(100), split: splitSchema
}).strict();
export const windowSessionSchema = z.object({version:z.literal(2),id:entityId,activeWorkspaceId:entityId,workspaces:z.array(workspaceSchema).min(1).max(20)}).strict().superRefine((state,ctx)=>{
  const ids=new Set<string>();
  if(!state.workspaces.some(w=>w.id===state.activeWorkspaceId))ctx.addIssue({code:'custom',message:'Missing active workspace'});
  for(const w of state.workspaces){
    for(const id of [w.id,...w.tabs.map(t=>t.id),...w.groups.map(g=>g.id)]){if(ids.has(id))ctx.addIssue({code:'custom',message:'Duplicate identifier'});ids.add(id);}
    if(!w.tabs.some(t=>t.id===w.activeId))ctx.addIssue({code:'custom',message:'Missing active tab'});
    if(w.tabs.some(t=>t.groupId&&!w.groups.some(g=>g.id===t.groupId)))ctx.addIssue({code:'custom',message:'Missing group'});
    const count=splitCount(w.split.mode);
    if(new Set(w.split.tabs).size!==w.split.tabs.length||w.split.tabs.some(id=>!w.tabs.some(t=>t.id===id))||(count>0&&w.split.tabs.length!==count))ctx.addIssue({code:'custom',message:'Invalid split panes'});
  }
  if(state.workspaces.reduce((n,w)=>n+w.tabs.length,0)>100)ctx.addIssue({code:'custom',message:'Too many tabs'});
});
export const checkpointSchema=z.object({windows:z.array(windowSessionSchema).min(1).max(8),clean:z.boolean()}).strict();
export type Split = z.infer<typeof splitSchema>;
export type Group = z.infer<typeof groupSchema>;
export type SavedTab = z.infer<typeof savedTabSchema>;
export type SavedWorkspace = z.infer<typeof workspaceSchema>;
export type WindowSession = z.infer<typeof windowSessionSchema>;
export type WorkspaceInfo = Omit<SavedWorkspace,'tabs'> & {tabCount:number;temporary:boolean};
export type Checkpoint = z.infer<typeof checkpointSchema>;
export const emptySplit=():Split=>({mode:'off',tabs:[],x:.5,y:.5});
export function splitCount(mode:Split['mode']){return mode==='off'?0:mode==='three'?3:mode==='grid'?4:2;}
export function partitionFor(workspaceId:string){return workspaceId==='default'?'persist:aster-default':`persist:aster-workspace-${entityId.parse(workspaceId)}`;}

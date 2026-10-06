import {describe,it,expect} from 'vitest';
import {windowSessionSchema,partitionFor,emptySplit,type WindowSession} from '../src/shared/workspace';
import {paneRects,SPLIT_GAP} from '../src/shared/layout';
import {commandSchema} from '../src/shared/schema';
const saved=():WindowSession=>({version:2,id:'window-1',activeWorkspaceId:'default',workspaces:[{id:'default',name:'Personal',color:'forest',theme:'inherit',recordHistory:true,activeId:'tab-1',groups:[],split:emptySplit(),tabs:[{id:'tab-1',title:'Example',url:'https://example.com/',pinned:true,muted:true,zoom:1.2,groupId:null}]}]});
describe('saved sessions and workspace boundary',()=>{
  it('accepts complete sessions and preserves tab metadata',()=>{expect(windowSessionSchema.parse(saved()).workspaces[0].tabs[0]).toMatchObject({pinned:true,muted:true,zoom:1.2});});
  it('rejects dangerous saved URLs before loading',()=>{const value=saved();value.workspaces[0].tabs[0].url='file:///C:/Windows/win.ini';expect(windowSessionSchema.safeParse(value).success).toBe(false);});
  it('rejects duplicate IDs, missing active tabs and dangling groups',()=>{const value=saved();value.workspaces[0].tabs.push({...value.workspaces[0].tabs[0]});expect(windowSessionSchema.safeParse(value).success).toBe(false);const missing=saved();missing.workspaces[0].activeId='missing';expect(windowSessionSchema.safeParse(missing).success).toBe(false);const group=saved();group.workspaces[0].tabs[0].groupId='missing';expect(windowSessionSchema.safeParse(group).success).toBe(false);});
  it('rejects split references to missing or duplicated tabs',()=>{const value=saved();value.workspaces[0].split={mode:'columns',tabs:['tab-1','tab-1'],x:.5,y:.5};expect(windowSessionSchema.safeParse(value).success).toBe(false);value.workspaces[0].split.tabs=['tab-1','missing'];expect(windowSessionSchema.safeParse(value).success).toBe(false);});
  it('retains legacy default session and isolates other workspaces',()=>{expect(partitionFor('default')).toBe('persist:aster-default');expect(partitionFor('work')).not.toBe(partitionFor('personal'));expect(()=>partitionFor('../unsafe')).toThrow();});
  it.each([{type:'workspace-create',name:' ',color:'forest'},{type:'split-resize',x:1,y:.5},{type:'tab-move',id:'valid',workspaceId:'../bad'},{type:'group-create',name:'Test',color:'url(https://evil)',icon:'folder'},{type:'session-save',name:'x'.repeat(81)}])('rejects malformed organization commands',value=>expect(commandSchema.safeParse(value).success).toBe(false));
});
describe('native split geometry',()=>{
  it.each(['columns','rows','three','grid'] as const)('keeps %s panes inside content without overlap',mode=>{
    const panes=paneRects(1011,633,{mode,tabs:[],x:.37,y:.61});
    expect(panes).toHaveLength(mode==='grid'?4:mode==='three'?3:2);
    for(const rect of panes){expect(rect.x).toBeGreaterThanOrEqual(0);expect(rect.y).toBeGreaterThanOrEqual(0);expect(rect.x+rect.width).toBeLessThanOrEqual(1011);expect(rect.y+rect.height).toBeLessThanOrEqual(633);}
    for(let i=0;i<panes.length;i++)for(let j=i+1;j<panes.length;j++){const a=panes[i],b=panes[j];expect(a.x+a.width<=b.x||b.x+b.width<=a.x||a.y+a.height<=b.y||b.y+b.height<=a.y).toBe(true);}
  });
  it('leaves an interactive divider gutter',()=>{const [a,b]=paneRects(1000,600,{mode:'columns',tabs:[],x:.5,y:.5});expect(b.x-a.width).toBe(SPLIT_GAP);});
});

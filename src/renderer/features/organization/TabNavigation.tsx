import {WidgetBoard} from '../appearance/WidgetBoard';
import {resolveStudio} from '../../../shared/studio';
import {useState,useLayoutEffect,useRef,useEffect} from 'react';
import type {Studio} from '../../../shared/studio';
import type {Snapshot,Tab} from '../../../shared/types';
import type {Group} from '../../../shared/workspace';
import {send} from '../../store';
import {Icon,IconButton,type IconName} from '../../components/Controls';

const groupIcon=(group:Group):IconName=>group.icon==='code'?'external':group.icon==='star'?'star':'folder';
function TabItem({tab,active,context,vertical=false,prefs}:{tab:Tab;active:boolean;context:(id:string)=>void;vertical?:boolean;prefs:Studio}){
  const [closing,setClosing]=useState(false);const timer=useRef<ReturnType<typeof setTimeout>|undefined>(undefined);useEffect(()=>()=>clearTimeout(timer.current),[]);
  const close=()=>{if(closing)return;const noMotion=matchMedia('(prefers-reduced-motion: reduce)').matches||document.documentElement.dataset.motion==='off'||document.documentElement.dataset.autoLow==='true';if(noMotion){void send({type:'close-tab',id:tab.id});return;}setClosing(true);timer.current=setTimeout(()=>void send({type:'close-tab',id:tab.id}),prefs.motionDuration);};
  return <div data-tab-id={tab.id} className={`tab ${closing?'tab-closing':''} ${active?'active':''} ${tab.pinned?'pinned':''} ${vertical?'vertical-tab':''}`} draggable onDragStart={e=>e.dataTransfer.setData('text/plain',tab.id)} onDragOver={e=>e.preventDefault()} onDrop={e=>{e.preventDefault();e.stopPropagation();void send({type:'reorder-tab',id:e.dataTransfer.getData('text/plain'),target:tab.id});}} onContextMenu={e=>{e.preventDefault();context(tab.id);}}>
    <button role="tab" tabIndex={active?0:-1} aria-label={tab.title} aria-selected={active} onClick={()=>void send({type:'select-tab',id:tab.id})} title={`${tab.title}\n${tab.url}${tab.muted?'\nMuted':''}${tab.floating?'\nFloating window':''}`}>
      <span className={tab.loading?'tab-spinner':'tab-icon'}>{!tab.loading&&<Icon name={tab.floating?'external':tab.pinned?'pin':tab.muted?'volume':tab.url==='aster://newtab'?'sun':'globe'} size={14}/>}</span><span className="tab-title">{tab.sleeping?"Zz ":""}{tab.title}</span>{prefs.tabAudio&&tab.muted&&<span className="tab-state" title="Audio muted">?</span>}{prefs.tabContainer&&vertical&&<span className="tab-container-dot" title="Workspace container"/>}
    </button>
    {!tab.pinned&&<button className="tab-close" aria-label={`Close ${tab.title}`} onClick={close}><Icon name="close" size={12}/></button>}
  </div>;
}
export function TabStrip({state,context,vertical=false,query=''}:{state:Snapshot;context:(id:string)=>void;vertical?:boolean;query?:string}){
  const workspace=state.workspaces.find(w=>w.id===state.activeWorkspaceId)!;
  const prefs=resolveStudio(state.settings,state.activeWorkspaceId,state.tabs.find(t=>t.id===state.activeId)?.url);
  const container=useRef<HTMLDivElement>(null),positions=useRef(new Map<string,DOMRect>());
  useLayoutEffect(()=>{const next=new Map<string,DOMRect>();container.current?.querySelectorAll<HTMLElement>('[data-tab-id]').forEach(el=>{const id=el.dataset.tabId!,rect=el.getBoundingClientRect(),old=positions.current.get(id);next.set(id,rect);if(old&&!matchMedia('(prefers-reduced-motion: reduce)').matches&&state.settings.motion!=='off'&&document.documentElement.dataset.autoLow!=='true'){const x=old.x-rect.x,y=old.y-rect.y;if(x||y)el.animate([{transform:`translate(${x}px,${y}px)`},{transform:'none'}],{duration:prefs.motionDuration,easing:'ease-out'});}});positions.current=next;},[state.tabs.map(t=>t.id+t.groupId).join(','),workspace.groups.map(g=>g.id+g.collapsed).join(','),vertical]);
  const tabs=state.tabs.filter(t=>`${t.title} ${t.url}`.toLowerCase().includes(query.toLowerCase()));
  const render=(tab:Tab)=><TabItem key={tab.id} tab={tab} active={tab.id===state.activeId} context={context} vertical={vertical} prefs={prefs}/>;
  return <div ref={container} onKeyDown={e=>{if(!(e.target instanceof HTMLElement)||e.target.getAttribute('role')!=='tab')return;const keys=vertical?['ArrowUp','ArrowDown']:['ArrowLeft','ArrowRight'];if(![...keys,'Home','End'].includes(e.key))return;e.preventDefault();const buttons=Array.from(e.currentTarget.querySelectorAll<HTMLButtonElement>('[role="tab"]'));const index=buttons.indexOf(e.target as HTMLButtonElement),next=e.key==='Home'?0:e.key==='End'?buttons.length-1:(index+(e.key===keys[0]?-1:1)+buttons.length)%buttons.length;buttons[next]?.focus();buttons[next]?.click();}} className={vertical?'vertical-tab-list':'tabs'} role="tablist" aria-label={vertical?'Vertical tabs':'Browser tabs'} aria-orientation={vertical?'vertical':'horizontal'}>
    {tabs.filter(t=>t.pinned).map(render)}
    {tabs.filter(t=>!t.pinned&&!t.groupId).map(render)}
    {workspace.groups.map(group=><div key={group.id} className={`tab-group group-${group.color} ${vertical?'vertical-group':''}`} onDragOver={e=>e.preventDefault()} onDrop={e=>{e.preventDefault();void send({type:'tab-group',id:e.dataTransfer.getData('text/plain'),groupId:group.id});}}>
      <button className="group-label" aria-expanded={!group.collapsed} aria-label={`${group.collapsed?'Expand':'Collapse'} ${group.name}`} onClick={()=>void send({type:'group-toggle',id:group.id})}><Icon name={groupIcon(group)} size={13}/><span>{group.name}</span><small>{state.tabs.filter(t=>t.groupId===group.id).length}</small></button>
      {(!group.collapsed||!!query)&&tabs.filter(t=>!t.pinned&&t.groupId===group.id).map(render)}
    </div>)}
    {query&&!tabs.length&&<p className="tab-search-empty">No matching tabs.</p>}
  </div>;
}
export function WorkspaceSidebar({state,context}:{state:Snapshot;context:(id:string)=>void}){
  const [query,setQuery]=useState('');const studio=resolveStudio(state.settings,state.activeWorkspaceId,state.tabs.find(t=>t.id===state.activeId)?.url);
  return <aside className="workspace-sidebar" onMouseEnter={()=>void send({type:'chrome-state',sidebar:false})} onMouseLeave={()=>{if(studio.sidebarMode==='auto'||studio.tabPosition==='auto'||studio.verticalMode==='hover')void send({type:'chrome-state',sidebar:true});}}>{state.sidebarCollapsed&&<button className="sidebar-reveal" aria-label="Expand sidebar" onClick={()=>void send({type:'chrome-state',sidebar:false})}>?</button>}<div className="workspace-sidebar-heading"><span className="eyebrow">YOUR SPACE</span><IconButton icon="settings" label="Manage workspaces and groups" onClick={()=>void send({type:'panel',value:'organize'})}/></div>
    {state.privacy.temporary&&<><span className="private-sidebar-label">Temporary · not saved</span><button className="sidebar-temporary-close" onClick={()=>void send({type:'workspace-delete',id:state.activeWorkspaceId})}>Close temporary container</button></>}
    <div className="workspace-switches">{state.workspaces.map(w=><button key={w.id} className={w.id===state.activeWorkspaceId?'selected':''} title={`${w.name} · ${w.tabCount} tabs`} aria-pressed={w.id===state.activeWorkspaceId} onClick={()=>void send({type:'workspace-switch',id:w.id})} onDragOver={e=>e.preventDefault()} onDrop={e=>{e.preventDefault();void send({type:'tab-move',id:e.dataTransfer.getData('text/plain'),workspaceId:w.id});}}><span className={`workspace-dot group-${w.color}`}/><span>{w.name}</span><small>{w.tabCount}</small></button>)}</div>
    <label className="tab-filter"><Icon name="search" size={14}/><input aria-label="Search open tabs" placeholder="Find a tab…" value={query} onChange={e=>setQuery(e.target.value)}/></label>
    <TabStrip state={state} context={context} vertical query={query}/>
    <button className="sidebar-new-tab" onClick={()=>void send({type:'new-tab'})}><Icon name="plus" size={16}/> New tab <kbd>Ctrl T</kbd></button>
    <nav className="sidebar-tools" aria-label="Sidebar tools">{([{panel:'privacy',icon:'shield',label:'Privacy'},{panel:'bookmarks',icon:'star',label:'Bookmarks'},{panel:'history',icon:'history',label:'History'},{panel:'downloads',icon:'download',label:'Downloads'},{panel:'sessions',icon:'folder',label:'Saved sessions'}] as const).map(item=><button key={item.panel} onClick={()=>void send({type:'panel',value:item.panel})}><Icon name={item.icon} size={15}/>{item.label}</button>)}</nav>
    <WidgetBoard state={state} zone="sidebar"/><div className="workspace-local"><Icon name="shield" size={13}/> Separate cookies. Local sessions.</div>
  </aside>;
}

import {websiteOrigin} from '../../../shared/studioAdvanced';
import type {ReactNode} from 'react';
import type {Snapshot,Panel,Tab} from '../../../shared/types';
import {resolveStudio,type WidgetId,widgetLabels} from '../../../shared/studio';
import {send} from '../../store';
import {IconButton,type IconName} from '../../components/Controls';
export function BrowserToolbar({state,tab,address,openPanel}:{state:Snapshot;tab:Tab;address:ReactNode;openPanel:(panel:Panel)=>void}){
  const studio=resolveStudio(state.settings,state.activeWorkspaceId,tab.url),workspace=state.workspaces.find(w=>w.id===state.activeWorkspaceId)!;
  const button=(id:WidgetId)=>{
    const icons:Partial<Record<WidgetId,IconName>>={back:'back',forward:'forward',reload:tab.loading?'close':'reload',home:'home',tabs:'folder',split:'maximize',downloads:'download',history:'history',notes:'copy',reading:'star',privacy:'shield',screenshot:'maximize',developer:'external',extensions:'folder',settings:'settings',menu:'menu'};
    const labels:Partial<Record<WidgetId,string>>={back:'Back (Alt+Left)',forward:'Forward (Alt+Right)',reload:tab.loading?'Stop loading':'Reload (Ctrl+R)',tabs:'Toggle vertical tabs',split:'Toggle split view (Ctrl+Shift+S)',downloads:'Downloads (Ctrl+J)'};
    const action=(event:React.MouseEvent<HTMLButtonElement>)=>{
      if(id==='extensions'){const rect=event.currentTarget.getBoundingClientRect();void send({type:'extension-toolbar',x:Math.round(rect.right),y:Math.round(rect.bottom+6)});}
      else if(id==='back'||id==='forward'||id==='home')void send({type:id});
      else if(id==='reload')void send({type:tab.loading?'stop':'reload'});
      else if(id==='tabs')void send({type:'settings-patch',value:{tabLayout:state.settings.tabLayout==='vertical'?'horizontal':'vertical',sidebarVisible:false}});
      else if(id==='split')void send({type:'split-set',mode:workspace.split.mode==='off'?'columns':'off'});
      else if(id==='screenshot')void send({type:'screenshot',action:'save'});
      else openPanel(id==='settings'?'studio':id as Panel);
    };
    return <IconButton icon={icons[id]!} label={labels[id]??widgetLabels[id]} onClick={action} onContextMenu={id==='extensions'?event=>{event.preventDefault();openPanel('extensions');}:undefined} title={id==='extensions'?'Extension controls - right-click to manage':labels[id]??widgetLabels[id]} disabled={id==='back'?!tab.canGoBack:id==='forward'?!tab.canGoForward:(id==='reload'||id==='screenshot')&&tab.url==='aster://newtab'}/>;
  };
  const editing=state.panel==='studio'&&!state.privacy.temporary;
  const drop=(event:React.DragEvent)=>{if(!editing)return;event.preventDefault();const id=event.dataTransfer.getData('application/x-aster-toolbar') as WidgetId,target=(event.target as HTMLElement).closest<HTMLElement>('[data-widget]')?.dataset.widget as WidgetId;if(!studio.toolbar.includes(id)||!studio.toolbar.includes(target)||id===target)return;const toolbar=studio.toolbar.filter(x=>x!==id);toolbar.splice(toolbar.indexOf(target),0,id);const next={...studio,toolbar},origin=websiteOrigin(tab.url);if(state.settings.siteStudios.some(p=>p.origin===origin))void send({type:'settings-patch',value:{siteStudios:state.settings.siteStudios.map(p=>p.origin===origin?{...p,studio:next}:p)}});else if(state.settings.workspaceStudios[state.activeWorkspaceId])void send({type:'settings-patch',value:{workspaceStudios:{...state.settings.workspaceStudios,[state.activeWorkspaceId]:next}}});else void send({type:'settings-patch',value:{studio:next}});};
  return <div className="toolbar studio-toolbar" data-editing={editing} onDragOver={e=>editing&&e.preventDefault()} onDrop={drop} onDragStart={e=>{if(!editing)return;const id=(e.target as HTMLElement).closest<HTMLElement>('[data-widget]')?.dataset.widget;if(id)e.dataTransfer.setData('application/x-aster-toolbar',id);}}>{[...studio.toolbar].sort((a,b)=>studio.toolbarZones?(['left','center','right'].indexOf(studio.widgetZones[a]??(a==='address'?'center':a==='menu'?'right':'left'))-['left','center','right'].indexOf(studio.widgetZones[b]??(b==='address'?'center':b==='menu'?'right':'left'))):0).map(id=>id==='address'?<div className="address-slot" data-widget={id} draggable={editing} key={id}>{address}</div>:id==='workspace'?<select key={id} data-widget={id} draggable={editing} className="toolbar-workspace" aria-label="Workspace" value={workspace.id} onChange={e=>void send({type:'workspace-switch',id:e.target.value})}>{state.workspaces.map(w=><option key={w.id} value={w.id}>{w.name}</option>)}</select>:id==='separator'?<span key={id} data-widget={id} draggable={editing} className="toolbar-divider"/>:id==='spacer'?<span key={id} data-widget={id} draggable={editing} className="toolbar-spacer"/>:<span className="toolbar-widget" draggable={editing} data-widget={id} key={id}>{button(id)}</span>)}</div>;
}

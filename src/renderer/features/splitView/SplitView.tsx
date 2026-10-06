import {useEffect,useRef,useState} from 'react';
import type {Snapshot,Tab} from '../../../shared/types';
import type {Split} from '../../../shared/workspace';
import {paneRects,SPLIT_GAP} from '../../../shared/layout';
import {send} from '../../store';
import {Icon,IconButton} from '../../components/Controls';

export function SplitView({state}:{state:Snapshot}){
  const split=state.workspaces.find(w=>w.id===state.activeWorkspaceId)!.split;
  const body=useRef<HTMLDivElement>(null);const [size,setSize]=useState({width:0,height:0});const [drag,setDrag]=useState<'x'|'y'|null>(null);
  const dragAxis=useRef<'x'|'y'|null>(null);
  const splitRef=useRef(split);splitRef.current=split;
  useEffect(()=>{const node=body.current;if(!node)return;const observer=new ResizeObserver(()=>setSize({width:node.clientWidth,height:node.clientHeight}));observer.observe(node);setSize({width:node.clientWidth,height:node.clientHeight});return()=>observer.disconnect();},[]);
  useEffect(()=>{
    const move=(e:PointerEvent)=>{const axis=dragAxis.current;const bounds=body.current?.getBoundingClientRect();if(!axis||!bounds)return;const ratio=Math.max(.2,Math.min(.8,axis==='x'?(e.clientX-bounds.left)/bounds.width:(e.clientY-bounds.top)/bounds.height));const current=splitRef.current;void send({type:'split-resize',x:axis==='x'?ratio:current.x,y:axis==='y'?ratio:current.y});};
    const end=()=>{if(!dragAxis.current)return;dragAxis.current=null;setDrag(null);void send({type:'split-drag',active:false});};
    window.addEventListener('pointermove',move);window.addEventListener('pointerup',end);window.addEventListener('pointercancel',end);
    return()=>{window.removeEventListener('pointermove',move);window.removeEventListener('pointerup',end);window.removeEventListener('pointercancel',end);void send({type:'split-drag',active:false});};
  },[]);
  const rects=paneRects(size.width,size.height,split);
  const separator=(axis:'x'|'y')=>{
    const vertical=axis==='x';const start=vertical?rects[0].width:split.mode==='three'?rects[1].height:rects[0].height;
    return <div key={axis} role="separator" tabIndex={0} aria-label={vertical?'Resize columns':'Resize rows'} aria-orientation={vertical?'vertical':'horizontal'} aria-valuemin={20} aria-valuemax={80} aria-valuenow={Math.round(split[axis]*100)} className={`split-divider divider-${axis}`} style={vertical?{left:start,top:0,width:SPLIT_GAP,height:'100%'}:{top:start,left:split.mode==='three'?rects[1].x:0,height:SPLIT_GAP,width:split.mode==='three'?rects[1].width:'100%'}} onPointerDown={e=>{e.preventDefault();e.currentTarget.setPointerCapture(e.pointerId);dragAxis.current=axis;setDrag(axis);void send({type:'split-drag',active:true});}} onKeyDown={e=>{if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home'].includes(e.key))return;e.preventDefault();const value=e.key==='Home'?.5:Math.max(.2,Math.min(.8,split[axis]+(['ArrowLeft','ArrowUp'].includes(e.key)?-.05:.05)));void send({type:'split-resize',x:vertical?value:split.x,y:vertical?split.y:value});}}><span/></div>;
  };
  return <div className="split-view"><div className="split-toolbar"><span><Icon name="maximize" size={14}/> Split view</span><select aria-label="Split layout" value={split.mode} onChange={e=>void send({type:'split-set',mode:e.target.value as Split['mode']})}><option value="columns">Two columns</option><option value="rows">Two rows</option><option value="three">Three panes</option><option value="grid">Four-pane grid</option></select><small>Click a pane to navigate it · Drag dividers to resize</small><button className="text-button" onClick={()=>void send({type:'split-set',mode:'off'})}>Exit split <Icon name="close" size={13}/></button></div>
    <div className="split-body" ref={body}>{rects.map((rect,index)=>{const tab=state.tabs.find(t=>t.id===split.tabs[index]);if(!tab)return null;return <section key={index} className={`split-pane ${tab.id===state.activeId?'active-pane':''}`} style={{left:rect.x,top:rect.y,width:rect.width,height:rect.height}} aria-label={`Pane ${index+1}`}><div className="pane-header"><span className="pane-number">{index+1}</span><select aria-label={`Tab in pane ${index+1}`} value={tab.id} onChange={e=>void send({type:'split-tab',index,id:e.target.value})}>{state.tabs.map(t=><option key={t.id} value={t.id}>{t.title}</option>)}</select><IconButton icon="external" label={`Float pane ${index+1}`} disabled={tab.url==='aster://newtab'} onClick={()=>void send({type:'float-tab',id:tab.id})}/></div><PanePlaceholder tab={tab}/></section>;})}
      {split.mode!=='rows'&&separator('x')}{split.mode!=='columns'&&separator('y')}
      {drag&&<div className={`split-drag-cover dragging-${drag}`}/>}
    </div>
  </div>;
}
export function PanePlaceholder({tab}:{tab:Tab}){
  const [query,setQuery]=useState('');
  if(tab.floating)return <div className="pane-placeholder"><Icon name="external" size={26}/><h2>This tab has a little more room.</h2><p>It is open in a floating window.</p><button onClick={()=>void send({type:'dock-tab',id:tab.id})}>Bring back to browser</button><label><input type="checkbox" checked={tab.alwaysOnTop} onChange={e=>void send({type:'float-top',id:tab.id,value:e.target.checked})}/> Always on top</label></div>;
  if(tab.error)return <div className="pane-placeholder"><Icon name="globe" size={26}/><h2>Page unavailable</h2><p>{tab.error}</p><button onClick={()=>void send({type:'select-tab',id:tab.id}).then(()=>send({type:'reload'}))}>Try again</button></div>;
  if(tab.url!=='aster://newtab')return null;
  return <div className="pane-placeholder"><Icon name="sun" size={28}/><h2>A fresh perspective.</h2><form onSubmit={e=>{e.preventDefault();void send({type:'select-tab',id:tab.id}).then(ok=>ok&&send({type:'navigate',input:query}));}}><input required aria-label={`Address for ${tab.id}`} placeholder="Search or enter a URL" value={query} onChange={e=>setQuery(e.target.value)}/><button aria-label="Open in pane"><Icon name="arrow" size={17}/></button></form><p>Open another page alongside your work.</p></div>;
}

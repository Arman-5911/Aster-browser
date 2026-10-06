import {useState} from 'react';
import type {Snapshot} from '../../../shared/types';
import type {Command} from '../../../shared/schema';
import {send} from '../../store';
export function CommandPalette({state}:{state:Snapshot}){
  const [query,setQuery]=useState('');const [selected,setSelected]=useState(0);
  const actions:{label:string;command:Command}[]=[{label:'Extensions / Load unpacked',command:{type:'panel',value:'extensions'}},
    ...(['ai','research','study'] as const).map(value=>({label:value==='ai'?'AI assistant':value==='research'?'Research mode':'Study mode',command:{type:'panel' as const,value}})),
    {label:'Customize Browser / Theme Studio',command:{type:'panel',value:'studio'}},{label:'Developer tools',command:{type:'panel',value:'developer'}},{label:'Password vault',command:{type:'panel',value:'vault'}},{label:'Lock password vault',command:{type:'vault-lock'}},{label:'New tab',command:{type:'new-tab'}},{label:'New private window',command:{type:'private-window'}},
    ...(['notes','reading','reader','settings','privacy','organize','sessions','bookmarks','history','downloads'] as const).map(value=>({label:({notes:'Notes',reading:'Reading list',reader:'Reading mode',settings:'Settings',privacy:'Privacy & permissions',organize:'Workspaces & groups',sessions:'Saved sessions',bookmarks:'Bookmarks',history:'History',downloads:'Downloads'})[value],command:{type:'panel' as const,value}})),
    {label:'Save current page to reading list',command:{type:'reading-add'}},
    ...state.tabs.map(tab=>({label:`Tab: ${tab.title}`,command:{type:'select-tab' as const,id:tab.id}})),
    ...state.workspaces.map(w=>({label:`Workspace: ${w.name}`,command:{type:'workspace-switch' as const,id:w.id}}))];
  const results=actions.filter(a=>a.label.toLowerCase().includes(query.toLowerCase())).slice(0,30);
  if(query.trim())results.push({label:`Search or open: ${query}`,command:{type:'navigate',input:query}});
  const index=Math.min(selected,Math.max(0,results.length-1));
  const run=async(command:Command)=>{await send({type:'panel',value:'none'});await send(command);};
  return <div className="command-palette"><h1>Where next?</h1><p className="page-subtitle">Find an action, tab or workspace. Arrow keys select; Enter runs; Escape closes.</p><input autoFocus aria-label="Command search" role="combobox" aria-expanded="true" aria-controls="command-results" aria-activedescendant={`command-${index}`} value={query} placeholder="Search commands or enter an address" onChange={e=>{setQuery(e.target.value);setSelected(0);}} onKeyDown={e=>{if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();setSelected((index+(e.key==='ArrowDown'?1:-1)+results.length)%results.length);}if(e.key==='Enter'&&results[index]){e.preventDefault();void run(results[index].command);}}}/><div id="command-results" role="listbox">{results.map((item,i)=><button id={`command-${i}`} role="option" aria-selected={index===i} key={item.label} onMouseEnter={()=>setSelected(i)} onClick={()=>void run(item.command)}>{item.label}</button>)}</div></div>;
}

import {useState} from 'react';
import type {Snapshot} from '../../../shared/types';
import type {Note} from '../../../shared/productivity';
import {send} from '../../store';
import './productivity.css';

export function ProductivityPage({state}:{state:Snapshot}){
  const [query,setQuery]=useState('');const [editing,setEditing]=useState<Note|null>();
  const [confirm,setConfirm]=useState<string>();const [filter,setFilter]=useState('all');
  const privateMode=state.workspaces.find(w=>w.id===state.activeWorkspaceId)!.temporary;
  const notes=state.panel==='notes';const active=state.tabs.find(t=>t.id===state.activeId)!;
  const matches=(text:string)=>text.toLowerCase().includes(query.toLowerCase());
  return <><h1>{notes?'Room for a thought.':'Keep a good read close.'}</h1><p className="page-subtitle">{privateMode?'Saving is disabled in temporary containers. Switch to a persistent workspace.':notes?'Plain-text notes saved in this workspace. Save your edits before leaving this page.':'A workspace reading queue. Links are saved locally; articles are not downloaded for offline use.'}</p>
    <div className="productivity-toolbar"><input aria-label={notes?'Search notes':'Search reading list'} placeholder="Search your collection" value={query} onChange={e=>setQuery(e.target.value)}/>{notes?<button disabled={privateMode||editing!==undefined} onClick={()=>setEditing(null)}>New note</button>:<><select aria-label="Reading filter" value={filter} onChange={e=>setFilter(e.target.value)}><option value="all">All</option><option value="unread">Unread</option><option value="read">Read</option></select><button disabled={privateMode||!/^https?:/.test(active.url)} onClick={()=>void send({type:'reading-add'})}>Save current page</button></>}</div>
    {notes&&editing!==undefined&&<NoteEditor key={editing?.id??'new'} note={editing} done={()=>setEditing(undefined)}/>}
    <div className="productivity-records">{notes?state.notes.filter(n=>matches(n.title+' '+n.body)).map(n=><section className="productivity-record" key={n.id}><h2>{n.title}</h2><p className="note-preview">{n.body.slice(0,240)||'Empty note'}</p><small>{new Date(n.updated_at).toLocaleString()}</small><div><button disabled={editing!==undefined} onClick={()=>setEditing(n)}>Edit {n.title}</button><button onClick={()=>setConfirm(n.id)}>Delete {n.title}</button></div>{confirm===n.id&&<div role="alert">Delete this note permanently? <button onClick={()=>setConfirm(undefined)}>Cancel</button><button onClick={()=>void send({type:'note-delete',id:n.id}).then(ok=>{if(ok){setConfirm(undefined);if(editing?.id===n.id)setEditing(undefined);}})}>Confirm delete</button></div>}</section>):state.readingList.filter(r=>matches(r.title+' '+r.url)&&(filter==='all'||!!r.is_read===(filter==='read'))).map(r=><section className="productivity-record" key={r.id}><h2>{r.title}</h2><p className="reading-url">{r.url}</p><div><button onClick={()=>void send({type:'navigate',input:r.url})}>Open {r.title}</button><button onClick={()=>void send({type:'reading-mark',id:r.id,read:!r.is_read})}>{r.is_read?'Mark unread':'Mark read'}</button><button onClick={()=>void send({type:'reading-delete',id:r.id})}>Remove {r.title}</button></div></section>)}</div>
    {!(notes?state.notes.length:state.readingList.length)&&<p className="page-subtitle">{notes?'Your notes will appear here.':'Save a website to start your reading list.'}</p>}
  </>;
}
function NoteEditor({note,done}:{note:Note|null;done:()=>void}){
  const [title,setTitle]=useState(note?.title??'');const [body,setBody]=useState(note?.body??'');const [saving,setSaving]=useState(false);
  return <form className="note-editor" onSubmit={e=>{e.preventDefault();setSaving(true);void send({type:'note-save',id:note?.id,title,body}).then(ok=>{setSaving(false);if(ok)done();});}}><label>Title<input autoFocus aria-label="Note title" required maxLength={120} value={title} onChange={e=>setTitle(e.target.value)}/></label><label>Note<textarea aria-label="Note text" maxLength={20000} value={body} onChange={e=>setBody(e.target.value)}/></label><small>{body.length} / 20,000 characters</small><div><button type="submit" disabled={saving||!title.trim()}>Save note</button><button type="button" disabled={saving} onClick={done}>Discard edits</button></div></form>;
}

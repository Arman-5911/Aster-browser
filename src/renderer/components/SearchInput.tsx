import {useId,type InputHTMLAttributes,type Ref} from 'react';
import type {Snapshot} from '../../shared/types';
import {searchSuggestions,type SuggestionSource} from '../../shared/searchSuggestions';
/** Native suggestions stay above Electron website views and retain keyboard navigation. */
export function SearchInput({state,inputRef,...props}:InputHTMLAttributes<HTMLInputElement>&{state:Snapshot;inputRef?:Ref<HTMLInputElement>}){
 const id=useId();const sources:SuggestionSource[]=[...state.tabs.map(t=>({url:t.url,title:t.title,kind:'Open tab' as const})),...(!state.privacy.temporary?[...state.bookmarks.map(t=>({...t,kind:'Bookmark' as const})),...state.history.map(t=>({...t,kind:'History' as const}))]:[]),...state.settings.quickLinks.map(t=>({url:t.url,title:t.name,kind:'Shortcut' as const}))];
 const suggestions=searchSuggestions(String(props.value??''),sources);
 return <><input {...props} ref={inputRef} list={id} autoComplete="off"/><datalist id={id}>{suggestions.map(s=><option key={s.url} value={s.url} label={s.kind+' / '+s.title}/>)}</datalist></>;
}

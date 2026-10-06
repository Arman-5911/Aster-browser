import {it,expect} from 'vitest';
import {Repository} from '../src/main/database';
import {commandSchema} from '../src/shared/schema';
import {settingsSchema} from '../src/shared/schema';
import {articleSchema} from '../src/shared/reader';
it('keeps note updates and deletions inside the owning workspace',()=>{
  const repo=new Repository(':memory:');try{
    repo.saveNote('a',undefined,'Idea','Text <script>');const note=repo.notes('a')[0];
    repo.saveNote('b',note.id,'Foreign edit','No');repo.deleteNote('b',note.id);
    expect(repo.notes('b')).toEqual([]);expect(repo.notes('a')[0].title).toBe('Idea');
    repo.saveNote('a',note.id,'Updated','Body');expect(repo.notes('a')[0].body).toBe('Body');
    repo.deleteNote('a',note.id);expect(repo.notes('a')).toEqual([]);
  }finally{repo.close();}
});
it('deduplicates reading URLs without resetting read state and isolates mutations',()=>{
  const repo=new Repository(':memory:');try{
    repo.addReading('a','First','https://example.com/');const id=repo.readingList('a')[0].id;
    repo.markReading('a',id,true);repo.addReading('a','Updated','https://example.com/');
    repo.markReading('b',id,false);repo.deleteReading('b',id);
    expect(repo.readingList('a')).toHaveLength(1);expect(repo.readingList('a')[0]).toMatchObject({title:'Updated',is_read:1});
    expect(repo.readingList('b')).toEqual([]);repo.deleteReading('a',id);expect(repo.readingList('a')).toEqual([]);
  }finally{repo.close();}
});
it('bounds note payloads and rejects extra command fields',()=>{
  expect(commandSchema.safeParse({type:'note-save',title:' ',body:'x'}).success).toBe(false);
  expect(commandSchema.safeParse({type:'note-save',title:'Test',body:'x'.repeat(20001)}).success).toBe(false);
  expect(commandSchema.safeParse({type:'reading-add',url:'javascript:alert(1)'}).success).toBe(false);
});
it('validates custom links and reader settings while filling old preferences',()=>{
  expect(commandSchema.parse({type:'settings-patch',value:{showRecent:false}})).toEqual({type:'settings-patch',value:{showRecent:false}});
  expect(commandSchema.safeParse({type:'settings-patch',value:{untrusted:true}}).success).toBe(false);
  expect(settingsSchema.parse({theme:'dark'}).quickLinks).toHaveLength(3);
  for(const url of ['javascript:alert(1)','file:///secret','https://user:pass@example.com'])expect(settingsSchema.safeParse({quickLinks:[{name:'Unsafe',url}]}).success).toBe(false);
  expect(settingsSchema.safeParse({readerSize:500}).success).toBe(false);
  expect(settingsSchema.safeParse({quickLinks:Array(9).fill({name:'Link',url:'https://example.com'})}).success).toBe(false);
  expect(articleSchema.safeParse({title:'Short',byline:'',text:'Not an article'}).success).toBe(false);
});

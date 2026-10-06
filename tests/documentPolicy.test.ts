import {it,expect} from 'vitest';
import path from 'node:path';
import {documentNavigation,documentFrame,documentKey,fileAccessKey,PDF_VIEWER} from '../src/main/documentPolicy';

it('allows site-owned blobs but not foreign blobs or remote-to-local navigation',()=>{
 const source='https://example.com/export';const local='file:///C:/docs/report.pdf';const approved=new Set([local]);
 expect(documentNavigation('blob:https://example.com/123',source,approved)).toBe(true);
 expect(documentNavigation('blob:https://other.test/123',source,approved)).toBe(false);
 expect(documentNavigation(local,source,approved)).toBe(false);
 expect(documentNavigation(local+'#page=2',local,approved)).toBe(true);
 expect(documentNavigation('file:///C:/Windows/win.ini',local,approved)).toBe(false);
 expect(documentNavigation('javascript:alert(1)',source,approved)).toBe(false);
 expect(documentNavigation('data:text/html,test',source,approved)).toBe(false);
 expect(documentKey(local+'#page=2')).toBe(local);
});
it('permits embedded documents and only the built-in PDF extension',()=>{
 const approved=new Set<string>();const source='https://example.com';
 for(const url of ['about:blank','about:srcdoc',PDF_VIEWER+'index.html'])expect(documentFrame(url,source,approved)).toBe(true);
 expect(documentFrame('chrome-extension://untrusted/index.html',source,approved)).toBe(false);
});
it('scopes file access to a selected file, requesting origin and access type',()=>{
 const details={filePath:path.resolve('report.pdf'),isDirectory:false,fileAccessType:'writable'};
 expect(fileAccessKey('https://example.com','https://example.com/editor',details,false)).not.toBe('');
 expect(fileAccessKey('https://example.com','https://other.test',details,false)).toBe('');
 expect(fileAccessKey('https://example.com',PDF_VIEWER+'index.html',details,false)).toBe('');
 expect(fileAccessKey('https://example.com/report',PDF_VIEWER+'index.html',details,true)).not.toBe('');
 expect(fileAccessKey('https://example.com','https://example.com',{...details,isDirectory:true},false)).toBe('');
 expect(fileAccessKey('https://example.com','https://example.com',{...details,filePath:'relative.txt'},false)).toBe('');
 expect(fileAccessKey('file:///C:/docs/a.html','file:///C:/docs/a.html',details,false)).toBe('');
});

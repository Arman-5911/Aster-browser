import {contextBridge,ipcRenderer} from 'electron';
import {supportsPlayerProtection} from '../shared/contentProtection';
import {protectYouTubePlayer} from './youtube';

// A separate sandboxed preload; never expose the trusted chrome bridge to websites.
// One synchronous, boolean-only policy check before the page's first script.
if(process.isMainFrame&&supportsPlayerProtection(location.href)){
  try{if(ipcRenderer.sendSync('aster:player-protection')===true)contextBridge.executeInMainWorld({func:protectYouTubePlayer});}catch{/* Keep playback usable if injection is unavailable. */}
}

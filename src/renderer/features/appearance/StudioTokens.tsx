import {useLayoutEffect} from 'react';
import type {Snapshot} from '../../../shared/types';
import {resolveStudio} from '../../../shared/studio';
import {chromeGeometry} from '../../../shared/layout';
export function StudioTokens({state}:{state?:Snapshot}){
  useLayoutEffect(()=>{
    if(!state)return;const s=resolveStudio(state.settings,state.activeWorkspaceId,state.tabs.find(t=>t.id===state.activeId)?.url),root=document.documentElement;
    const geometry=chromeGeometry(state.settings,state.activeWorkspaceId,state.tabs.find(t=>t.id===state.activeId)?.url,state.chromeHidden,state.sidebarCollapsed);
    root.dataset.interface=s.interfaceStyle;root.dataset.searchStyle=s.searchStyle;root.dataset.searchNewTab=String(s.searchNewTab);root.dataset.studioBackground=s.background;root.dataset.glass=String(s.glass);root.dataset.everywhere=String(s.wallpaperEverywhere);root.dataset.palette=s.palette;root.dataset.quality=s.quality;root.dataset.sidebarSide=s.tabPosition==='right'?'right':s.tabPosition==='left'?'left':s.sidebarSide;root.dataset.addressMode=s.addressMode;root.dataset.cleanStart=String(s.cleanStart);root.dataset.tabTitles=String(s.tabTitles);root.dataset.studioSpacing=s.spacing;
    const cap=s.quality==='performance'?0:s.quality==='balanced'?16:50;
    const vars:Record<string,string>={
      '--chrome-height':geometry.height+'px','--toolbar-height':s.toolbarHeight+'px','--sidebar-width':geometry.sidebar+'px',
      '--studio-radius':s.radius+'px','--studio-font':({system:'"Segoe UI", system-ui, sans-serif',humanist:'Candara, Calibri, sans-serif',mono:'Consolas, monospace'})[s.font],'--studio-font-size':s.fontSize+'px',
      '--glass-opacity':s.glassOpacity+'%','--glass-tint':s.glassTint,'--glass-highlight':s.highlight+'%',
      '--studio-shadow':({none:'none',minimal:'0 2px 6px #0000000a',soft:'0 8px 24px #00000016',deep:'0 16px 40px #00000030'})[s.shadow],
      '--search-tint':s.searchTint,'--search-opacity':s.searchOpacity+'%','--search-border':s.searchBorder+'px','--search-shadow':({none:'none',soft:'0 3px 12px #0000000c',lifted:'0 8px 22px #00000020'})[s.searchShadow],
      '--address-width':s.addressWidth+'px','--address-radius':s.addressRadius+'px','--address-font':s.addressFont+'px','--studio-tab-radius':s.tabRadius+'px','--studio-tab-gap':s.tabGap+'px',
      '--studio-wallpaper':s.background==='solid'?s.backgroundColor:s.background==='gradient'?`linear-gradient(135deg,${s.backgroundColor},${s.gradientColor})`:state.settings.wallpaper?`url("aster://app/wallpaper.jpg?v=${state.settings.wallpaper}")`:`linear-gradient(135deg,${s.backgroundColor},${s.gradientColor})`,
      '--studio-image-size':({cover:'cover',contain:'contain',stretch:'100% 100%',center:'auto',tile:'auto'})[s.imageFit],'--studio-image-repeat':s.imageFit==='tile'?'repeat':'no-repeat','--studio-image-position':`${s.imageX}% ${s.imageY}%`,'--studio-image-scale':String(s.imageScale/100),
      '--studio-image-filter':`blur(${Math.min(state.settings.wallpaperBlur,cap)}px) brightness(${s.brightness}%) saturate(${s.saturation}%) contrast(${s.contrast}%)`,
      '--studio-gap':({compact:'5px',balanced:'10px',comfortable:'15px'})[s.spacing]
    };
    for(const key of ['toolbar','sidebar','tab','panel','widget'] as const)vars[`--${key}-blur`]=Math.min(s[`${key}Blur`],cap)+'px';
    for(const [key,value] of Object.entries(vars))root.style.setProperty(key,value);
  },[state?.settings,state?.activeWorkspaceId,state?.activeId,state?.tabs,state?.chromeHidden,state?.sidebarCollapsed]);
  return null;
}

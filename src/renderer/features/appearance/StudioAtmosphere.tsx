import {useEffect,useLayoutEffect,useRef,useState} from 'react';
import {resolveStudio} from '../../../shared/studio';
import {wallpaperIndex,imageColors} from '../../../shared/studioAdvanced';
import type {Snapshot} from '../../../shared/types';
export function StudioAtmosphere({state}:{state:Snapshot}){
  const [now,setNow]=useState(Date.now()),[reduced,setReduced]=useState(matchMedia('(prefers-reduced-motion: reduce)').matches),[visible,setVisible]=useState(!document.hidden);
  const [legacyColors,setLegacyColors]=useState<{brightness:number;color:string}|null>(null);
  const video=useRef<HTMLVideoElement>(null),root=document.documentElement;
  const s=resolveStudio(state.settings,state.activeWorkspaceId,state.tabs.find(t=>t.id===state.activeId)?.url);
  const assets=state.settings.wallpaperAssets.filter(a=>s.wallpaperMode==='video'?a.kind==='video':a.kind==='image');
  const asset=assets[wallpaperIndex(s.wallpaperMode,s.wallpaperSlot,assets.length,s.rotationMinutes,now)];
  const colorSource=s.wallpaperMode==='static'?legacyColors:asset;
  useEffect(()=>{if(!state.settings.wallpaper||!s.adaptiveColors){setLegacyColors(null);return;}let disposed=false;const image=new Image();image.onload=()=>{if(disposed)return;const canvas=document.createElement('canvas');canvas.width=32;canvas.height=32;const ctx=canvas.getContext('2d')!;ctx.drawImage(image,0,0,32,32);try{setLegacyColors(imageColors(ctx.getImageData(0,0,32,32).data));}catch{setLegacyColors(null);}};image.src='aster://app/wallpaper.jpg?v='+state.settings.wallpaper;return()=>{disposed=true;};},[state.settings.wallpaper,s.adaptiveColors]);
  const low=s.quality==='performance'||s.autoPerformance&&(state.system.onBattery||state.system.memoryTotal<6*1024**3||state.system.cpuCount<4);
  const animated=!low&&!reduced&&state.settings.motion!=='off'&&visible;
  const night=new Date(now).getHours()<7||new Date(now).getHours()>=19;
  useEffect(()=>{const id=setInterval(()=>setNow(Date.now()),30000),media=matchMedia('(prefers-reduced-motion: reduce)');const motion=()=>setReduced(media.matches),visibility=()=>setVisible(!document.hidden);media.addEventListener('change',motion);document.addEventListener('visibilitychange',visibility);return()=>{clearInterval(id);media.removeEventListener('change',motion);document.removeEventListener('visibilitychange',visibility);};},[]);
  useLayoutEffect(()=>{
    root.dataset.autoLow=String(low);root.dataset.ambient=animated?s.wallpaperMode:'static';root.dataset.noise=s.noise;root.dataset.refraction=low?'off':s.refraction;
    root.dataset.advancedWallpaper=String(s.wallpaperMode!=='static');root.dataset.tabPosition=s.tabPosition;root.dataset.verticalMode=s.verticalMode;root.dataset.sidebarMode=s.sidebarMode;root.dataset.pinnedStyle=s.pinnedStyle;root.dataset.groupStyle=s.groupStyle;
    root.dataset.tabBorder=String(s.tabBorder);root.dataset.tabShadow=String(s.tabShadow);root.dataset.tabCloseHidden=String(s.tabCloseHidden);
    root.dataset.toolbarHidden=String(state.chromeHidden);root.dataset.sidebarCollapsed=String(state.sidebarCollapsed);
    const variables:Record<string,string>={'--advanced-dim':(s.scheduledDim?(night?s.nightDim:s.dayDim):state.settings.wallpaperShade)+'%','--motion-duration':s.motionDuration+'ms','--spring-ease':`cubic-bezier(.2,.8,.2,${1+s.spring/500})`,'--tab-height':s.tabHeight+'px','--tab-padding':s.tabPadding+'px','--tab-icon-size':s.tabIconSize+'px','--ui-weight':String(s.fontWeight),'--ui-tracking':s.letterSpacing+'px','--sidebar-font':s.sidebarFont+'px','--menu-font':s.menuFont+'px','--light-angle':s.lightDirection+'deg','--highlight-thickness':s.highlightThickness+'px','--frost':String(1+s.frost/200)};
    for(const key of ['toolbar','tabs','sidebar','panel','widget'] as const)variables[`--${key}-opacity`]=(s.separateOpacity?s[`${key}Opacity`]:s.glassOpacity)+'%';
    if(s.adaptiveColors&&colorSource){root.dataset.palette=colorSource.brightness>.6?'paper':'graphite';variables['--glass-tint']=colorSource.color;}
    else if(s.adaptiveTime)root.dataset.palette=night?'midnight':'paper';
    else root.dataset.palette=s.palette;
    if(s.wallpaperMode!=='static')variables['--studio-wallpaper']=asset?.kind==='image'?`url("aster://app/wallpaper-asset/${asset.id}")`:`linear-gradient(135deg,${s.backgroundColor},${s.gradientColor})`;
    for(const [key,value] of Object.entries(variables))root.style.setProperty(key,value);
  },[s,asset,colorSource,night,low,animated,state.chromeHidden,state.sidebarCollapsed,state.settings.wallpaperShade]);
  useEffect(()=>{const el=video.current;if(!el)return;if(animated)void el.play().catch(()=>{});else el.pause();},[animated,asset?.id]);
  useEffect(()=>{
    if(!s.parallax||!animated){root.style.setProperty('--parallax-x','0px');root.style.setProperty('--parallax-y','0px');return;}
    let pending=0;const move=(e:PointerEvent)=>{if(pending)return;pending=requestAnimationFrame(()=>{pending=0;root.style.setProperty('--parallax-x',((e.clientX/innerWidth-.5)*s.parallax)+'px');root.style.setProperty('--parallax-y',((e.clientY/innerHeight-.5)*s.parallax)+'px');});};window.addEventListener('pointermove',move,{passive:true});return()=>{window.removeEventListener('pointermove',move);cancelAnimationFrame(pending);};
  },[s.parallax,animated]);
  useEffect(()=>{
    if(s.workspaceTransition==='none'||!animated)return;
    const el=document.querySelector('.content');const animation=el?.animate([{opacity:.3,transform:s.workspaceTransition==='slide'?'translateX(5px)':'none'},{opacity:1,transform:'none'}],{duration:s.motionDuration,easing:'ease-out'});return()=>animation?.cancel();
  },[state.activeWorkspaceId]);
  const showVideo=s.wallpaperMode==='video'&&asset?.kind==='video';
  const [failed,setFailed]=useState(false);useEffect(()=>setFailed(false),[asset?.id]);
  return <><svg className="glass-filters" aria-hidden="true"><defs><filter id="aster-glass-edge"><feTurbulence type="fractalNoise" baseFrequency=".012 .025" numOctaves="1" seed="8" result="grain"/><feDisplacementMap in="SourceGraphic" in2="grain" scale={s.refraction==='medium'?5:2} xChannelSelector="R" yChannelSelector="G"/></filter></defs></svg><div className="studio-wallpaper" aria-hidden="true">{showVideo&&!failed&&<video ref={video} key={asset.id} src={`aster://app/wallpaper-asset/${asset.id}`} muted loop playsInline preload="metadata" onError={()=>setFailed(true)}/>}<div className="wallpaper-grain"/></div></>;
}

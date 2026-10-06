import {useEffect,useState} from 'react';
import {send,useBrowser} from '../store';
import './StartupReveal.css';
export function StartupReveal(){
 const settings=useBrowser(s=>s.state?.settings);const [visible,setVisible]=useState(true);const [imageReady,setImageReady]=useState(false);const [leaving,setLeaving]=useState(false);
 const ready=!!settings&&imageReady;
 useEffect(()=>{
  if(!visible)return;
  const finish=()=>{setVisible(false);if(window.aster)void send({type:'startup-ready'});};
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  const quiet=reduced.matches||settings?.motion==='off';
  const fade=ready?setTimeout(()=>setLeaving(true),quiet?2000:5000):undefined;
  const timer=setTimeout(finish,ready?(quiet?2400:5800):9000);
  const skip=(event:KeyboardEvent)=>{if(event.key==='Escape')finish();};
  window.addEventListener('keydown',skip);reduced.addEventListener('change',finish);
  return()=>{clearTimeout(timer);clearTimeout(fade);window.removeEventListener('keydown',skip);reduced.removeEventListener('change',finish);};
 },[visible,ready,settings?.motion]);
 if(!visible)return null;
 return <div className="startup-reveal" data-ready={ready} data-leaving={leaving} data-quiet={settings?.motion==='off'} aria-label="Aster startup">
  <div className="startup-runway" aria-hidden="true"/>
  <div className="startup-stage" aria-hidden="true">
   <div className="startup-orbit startup-orbit-blue"/><div className="startup-orbit startup-orbit-gold"/>
   <div className="startup-trail"/><img className="startup-emblem" src="/aster-startup-transparent.png" alt="" onLoad={()=>setImageReady(true)} onError={()=>setImageReady(true)} draggable={false}/>
   <div className="startup-horizon"/>
  </div>
  <div className="startup-caption"><span>ASTER</span><p>A new perspective.</p></div>
  <button className="startup-skip" onClick={()=>{setVisible(false);if(window.aster)void send({type:'startup-ready'});}}>Skip intro <span>Esc</span></button>
 </div>;
}

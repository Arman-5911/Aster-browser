import type { Repository } from './database';
import type { WindowSession } from '../shared/workspace';

/** Owns the one application-wide checkpoint; controllers never overwrite one another. */
export class SessionCoordinator {
  private timer?:ReturnType<typeof setTimeout>;
  private last:WindowSession[]=[];
  private quitting=false;
  pending:WindowSession[]=[];
  constructor(private repo:Repository,private collect:()=>WindowSession[]){
    const checkpoint=repo.checkpoint();
    if(checkpoint&&!checkpoint.clean)this.pending=checkpoint.windows;
    this.last=checkpoint?.windows??[];
  }
  startup():WindowSession[]{const checkpoint=this.repo.checkpoint();return checkpoint?.clean&&this.repo.settings().restoreOnStartup?checkpoint.windows:[];}
  changed=()=>{if(this.quitting||this.pending.length)return;clearTimeout(this.timer);this.timer=setTimeout(()=>this.flush(false),200);};
  flush(clean:boolean){if(this.quitting)return;clearTimeout(this.timer);const current=this.collect();if(current.length)this.last=current;if(this.pending.length)return;if(this.last.length)this.repo.saveCheckpoint({windows:this.last,clean});}
  closing(){if(!this.quitting)this.flush(false);}
  quit(){if(this.quitting)return;this.flush(true);this.quitting=true;clearTimeout(this.timer);}
  recover(restore:boolean){const saved=this.pending;this.pending=[];this.last=[];this.repo.clearCheckpoint();return restore?saved:[];}
}

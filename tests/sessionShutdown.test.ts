import {it,expect,vi} from 'vitest';
import {SessionCoordinator} from '../src/main/sessionCoordinator';
import {Repository} from '../src/main/database';
it('does not collect windows or touch the repository after final checkpoint',()=>{
 vi.useFakeTimers();const repo=new Repository(':memory:');const collect=vi.fn(()=>[]);const coordinator=new SessionCoordinator(repo,collect);
 try{coordinator.changed();coordinator.quit();repo.close();expect(()=>{coordinator.quit();coordinator.flush(false);coordinator.changed();coordinator.closing();vi.runAllTimers();}).not.toThrow();expect(collect).toHaveBeenCalledTimes(1);}finally{vi.useRealTimers();}
});

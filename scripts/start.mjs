import { spawn } from 'node:child_process';
import electron from 'electron';
const env={...process.env};
delete env.ELECTRON_RUN_AS_NODE;
// This is the interactive browser, so Windows must not hide its first window.
const child=spawn(electron,['.'],{stdio:'inherit',env,windowsHide:false});
child.on('exit',code=>process.exit(code??0));
child.on('error',()=>{console.error('Could not launch Electron. Run npm install and try again.');process.exit(1);});

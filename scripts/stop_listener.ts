import { styleText } from 'node:util';

//
// Stops a process of ours that is already listening on a port, so that starting it again replaces it
// instead of failing with EADDRINUSE. (For example, a server or debug Chrome that a coding agent
// started in the background, where you can't see it or Ctrl-C it.)
//
// It only stops a process whose command line matches `isOurs`, so it never kills something else that
// happens to use the port; for anything else it prints what's there and leaves it alone.
// This uses `lsof` and `ps`, so it works on macOS and Linux. Elsewhere it does nothing.
//
export async function stopListenerAsync(port: number, isOurs: RegExp): Promise<void> {
  if (process.platform === 'win32') return;

  for (const pid of listenerPIDs(port)) {
    const command = commandOf(pid);
    if (!isOurs.test(command)) {
      console.log(styleText('yellowBright', `Port ${port} is in use by another program (pid ${pid}), leaving it alone:  ${command}`));
      continue;
    }

    console.log(styleText('yellowBright', `Stopping the previous one on port ${port} (pid ${pid})`));
    try {
      process.kill(pid, 'SIGTERM');
    } catch {
      continue;   // it already exited
    }

    // Give it a few seconds to exit on its own, then insist.
    for (let i = 0; i < 50 && isAlive(pid); i++) {
      await Bun.sleep(100);
    }
    if (isAlive(pid)) {
      process.kill(pid, 'SIGKILL');
      await Bun.sleep(200);
    }
  }
}


// The process IDs listening on a TCP port, other than this one.
function listenerPIDs(port: number): number[] {
  try {
    const result = Bun.spawnSync(['lsof', '-nP', '-t', `-iTCP:${port}`, '-sTCP:LISTEN']);
    return result.stdout.toString()
      .split('\n')
      .map(Number)
      .filter(pid => pid > 0 && pid !== process.pid);
  } catch {
    return [];   // no `lsof`
  }
}


// A process's full command line, or '' if it can't be found.
function commandOf(pid: number): string {
  try {
    return Bun.spawnSync(['ps', '-o', 'command=', '-p', String(pid)]).stdout.toString().trim();
  } catch {
    return '';
  }
}


// Whether a process is still running.
function isAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);   // signal 0 only checks
    return true;
  } catch {
    return false;
  }
}

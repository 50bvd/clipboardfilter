import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export async function simulate(key: string, modifiers: string[] = []): Promise<void> {
  const platform = process.platform;

  try {
    if (platform === 'win32') {
      await simulateWindows(key, modifiers);
    } else if (platform === 'darwin') {
      await simulateMac(key, modifiers);
    } else if (platform === 'linux') {
      await simulateLinux(key, modifiers);
    }
  } catch (error) {
    console.error('Failed to simulate keyboard input:', error);
  }
}

async function simulateWindows(key: string, modifiers: string[]): Promise<void> {
  // Use PowerShell with SendKeys
  const mod = modifiers.includes('control') ? '^' : '';
  const cmd = `powershell -Command "$wshell = New-Object -ComObject wscript.shell; $wshell.SendKeys('${mod}${key}')"`;
  await execAsync(cmd);
}

async function simulateMac(key: string, modifiers: string[]): Promise<void> {
  // Use osascript (AppleScript)
  const mod = modifiers.includes('control') ? 'command' : '';
  const script = `tell application "System Events" to keystroke "${key}" using {${mod} down}`;
  await execAsync(`osascript -e '${script}'`);
}

async function simulateLinux(key: string, modifiers: string[]): Promise<void> {
  // Use xdotool
  const mod = modifiers.includes('control') ? 'ctrl+' : '';
  await execAsync(`xdotool key ${mod}${key}`);
}

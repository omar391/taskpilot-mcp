/**
 * Process Management Utilities
 * 
 * Handles TaskPilot process detection and cleanup
 */

import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

/**
 * Find TaskPilot processes by name or command pattern
 */
export async function findTaskPilotProcesses(): Promise<Array<{pid: string, command: string}>> {
  try {
    // Look for node processes running TaskPilot
    const { stdout } = await execAsync('ps aux | grep -E "(taskpilot|build/index\\.js)" | grep -v grep');
    const lines = stdout.trim().split('\n').filter(line => line.trim());
    
    const processes: Array<{pid: string, command: string}> = [];
    
    for (const line of lines) {
      const parts = line.trim().split(/\s+/);
      if (parts.length >= 11) {
        const pid = parts[1];
        const command = parts.slice(10).join(' ');
        processes.push({ pid, command });
      }
    }
    
    return processes;
  } catch (error) {
    return [];
  }
}

/**
 * Kill all TaskPilot processes except the current one
 */
export async function killExistingTaskPilotProcesses(): Promise<number> {
  try {
    const currentPid = process.pid.toString();
    const processes = await findTaskPilotProcesses();
    
    let killedCount = 0;
    
    for (const proc of processes) {
      if (proc.pid !== currentPid) {
        try {
          // Try graceful termination first
          await execAsync(`kill ${proc.pid}`);
          console.log(`Terminated existing TaskPilot process ${proc.pid}: ${proc.command.substring(0, 60)}...`);
          killedCount++;
        } catch (error) {
          try {
            // Force kill if graceful fails
            await execAsync(`kill -9 ${proc.pid}`);
            console.log(`Force killed TaskPilot process ${proc.pid}`);
            killedCount++;
          } catch (forceError) {
            console.warn(`Failed to kill TaskPilot process ${proc.pid}:`, forceError);
          }
        }
      }
    }
    
    if (killedCount > 0) {
      // Wait for processes to clean up
      await new Promise(resolve => setTimeout(resolve, 1500));
    }
    
    return killedCount;
  } catch (error) {
    console.warn('Error killing existing TaskPilot processes:', error);
    return 0;
  }
}

/**
 * Check if there are other TaskPilot instances running
 */
export async function hasOtherTaskPilotInstances(): Promise<boolean> {
  const processes = await findTaskPilotProcesses();
  const currentPid = process.pid.toString();
  
  return processes.some(proc => proc.pid !== currentPid);
}

/**
 * Create a graceful shutdown handler
 */
export function createShutdownHandler(serverName: string = 'TaskPilot Server'): (signal: string) => void {
  return (signal: string) => {
    console.log(`\n${signal} received. Shutting down ${serverName} gracefully...`);
    
    // Give time for cleanup
    setTimeout(() => {
      console.log(`${serverName} shutdown complete.`);
      process.exit(0);
    }, 1000);
  };
}

/**
 * Register standard process signal handlers
 */
export function registerSignalHandlers(serverName: string = 'TaskPilot Server'): void {
  const handler = createShutdownHandler(serverName);
  
  process.on('SIGINT', () => handler('SIGINT'));
  process.on('SIGTERM', () => handler('SIGTERM'));
  process.on('SIGUSR1', () => handler('SIGUSR1'));
  process.on('SIGUSR2', () => handler('SIGUSR2'));
  
  // Handle uncaught exceptions gracefully
  process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
    console.log('Shutting down due to uncaught exception...');
    process.exit(1);
  });
  
  process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    console.log('Shutting down due to unhandled rejection...');
    process.exit(1);
  });
}

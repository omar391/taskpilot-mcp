// TaskPilot InstanceManager: Handles main/proxy instance logic, lock file, version/PID checks, and proxying

import fs from "fs";
import path from "path";
import os from "os";
import { spawn, execSync } from "child_process";
import http from "http";
import type { Server as HttpServer } from "http";

export interface InstanceLock {
  pid: number;
  version: string;
  timestamp: number;
}

export enum InstanceRole {
  MAIN = "main",
  PROXY = "proxy",
  UNKNOWN = "unknown"
}

export class InstanceManager {
  static VERSION = "0.1.0";

  lockPath: string;
  port: number;

  role: InstanceRole = InstanceRole.UNKNOWN;
  proxyPort: number | null = null;
  lock: InstanceLock | null = null;

  constructor(lockPath?: string, port?: number) {
    this.lockPath = lockPath ?? path.join(os.tmpdir(), "taskpilot-8989.lock");
    this.port = port ?? 8989;
  }

  // Try to become main instance by atomically creating lock file and binding port
  async tryBecomeMain(): Promise<boolean> {
    try {
      // Use O_EXCL|O_CREAT for atomic creation
      const fd = fs.openSync(this.lockPath, "wx");
      const lock: InstanceLock = {
        pid: process.pid,
        version: InstanceManager.VERSION,
        timestamp: Date.now(),
      };
      fs.writeFileSync(fd, JSON.stringify(lock), { encoding: "utf-8" });
      fs.closeSync(fd);
      this.lock = lock;
      this.role = InstanceRole.MAIN;
      return true;
    } catch (err: any) {
      if (err.code === "EEXIST") {
        // Lock file exists, cannot become main
        return false;
      }
      throw err;
    }
  }

  // Read and validate lock file (version, PID liveness)
  async readLock(): Promise<InstanceLock | null> {
    // First check if the lock file exists
    if (!fs.existsSync(this.lockPath)) {
      this.lock = null;
      return null;
    }
    
    try {
      const raw = fs.readFileSync(this.lockPath, "utf-8");
      const lock: InstanceLock = JSON.parse(raw);
      if (
        typeof lock.pid === "number" &&
        typeof lock.version === "string" &&
        typeof lock.timestamp === "number"
      ) {
        this.lock = lock;
        return lock;
      }
      return null;
    } catch {
      return null;
    }
  }

  // Write lock file with current PID/version
  async writeLock(): Promise<void> {
    const lock: InstanceLock = {
      pid: process.pid,
      version: InstanceManager.VERSION,
      timestamp: Date.now(),
    };
    fs.writeFileSync(this.lockPath, JSON.stringify(lock), {
      encoding: "utf-8",
      flag: "w",
    });
    this.lock = lock;
  }

  // Remove lock file (cleanup)
  async removeLock(): Promise<void> {
    try {
      fs.unlinkSync(this.lockPath);
    } catch {}
  }

  // Check if PID is alive
  static isPidAlive(pid: number): boolean {
    try {
      process.kill(pid, 0);
      return true;
    } catch {
      return false;
    }
  }

  // Check version of running main instance via HTTP
  async fetchMainVersion(): Promise<string | null> {
    return new Promise((resolve) => {
      const req = http.get(
        { hostname: "127.0.0.1", port: this.port, path: "/__version", timeout: 2000 },
        (res) => {
          let data = "";
          res.on("data", (chunk) => (data += chunk));
          res.on("end", () => {
            try {
              const json = JSON.parse(data);
              resolve(json.version || null);
            } catch {
              resolve(null);
            }
          });
        }
      );
      req.on("error", () => resolve(null));
      req.end();
    });
  }

  // Send shutdown request to main instance
  async requestMainShutdown(): Promise<boolean> {
    return new Promise((resolve) => {
      const req = http.request(
        { hostname: "127.0.0.1", port: this.port, path: "/__shutdown", method: "POST", timeout: 2000 },
        (res) => {
          resolve(res.statusCode === 200);
        }
      );
      req.on("error", () => resolve(false));
      req.end();
    });
  }

  // Wait for port 8989 to become available
  async waitForPort(timeoutMs = 10000): Promise<boolean> {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      try {
        const s = http.createServer();
        await new Promise((resolve, reject) => {
          s.once("error", reject);
          s.listen(this.port, () => {
            s.close();
            resolve(true);
          });
        });
        return true;
      } catch {
        // Port still in use
        await new Promise((r) => setTimeout(r, 300));
      }
    }
    return false;
  }

  // Start reverse proxy to main instance
  async startProxy(): Promise<HttpServer> {
    // Dynamically import http-proxy to avoid dependency if not needed
    const httpProxy = (await import("http-proxy")).default;
    const proxy = httpProxy.createProxyServer({
      target: `http://127.0.0.1:${this.port}`,
      ws: true,
      changeOrigin: true,
      autoRewrite: true,
    });

    const server = http.createServer((req, res) => {
      proxy.web(req, res, {}, (err: Error & { code?: string }) => {
        res.writeHead(502, { "Content-Type": "text/plain" });
        res.end("Proxy error: " + err?.message);
      });
    });

    // Proxy websockets as well
    server.on("upgrade", (req, socket, head) => {
      proxy.ws(req, socket, head);
    });

    // Listen on a random available port
    await new Promise<void>((resolve) => {
      server.listen(0, "127.0.0.1", () => resolve());
    });
    const address = server.address();
    if (typeof address === "object" && address && "port" in address) {
      this.proxyPort = address.port as number;
    }
    this.role = InstanceRole.PROXY;
    return server;
  }
}
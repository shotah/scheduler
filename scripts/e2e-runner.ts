#!/usr/bin/env ts-node

import { spawn, ChildProcess } from 'child_process';
import http from 'http';

interface ServerProcess {
  process: ChildProcess;
  port: number;
  name: string;
}

class E2ERunner {
  private servers: ServerProcess[] = [];

  async run(): Promise<void> {
    console.log('🚀 Starting E2E test automation...');
    
    try {
      // 1. Kill any existing processes
      await this.killExistingProcesses();
      
      // 2. Start servers
      await this.startServers();
      
      // 3. Wait for servers to be ready
      await this.waitForServers();
      
      // 4. Run Playwright tests
      console.log('🎭 Running Playwright tests...');
      await this.runPlaywrightTests();
      
      console.log('✅ E2E tests completed successfully!');
      
    } catch (error) {
      console.error('❌ E2E tests failed:', error);
      process.exit(1);
    } finally {
      // 5. Cleanup
      await this.cleanup();
    }
  }

  private async killExistingProcesses(): Promise<void> {
    console.log('🧹 Cleaning up existing processes...');
    
    // Skip kill for now - just continue
    console.log('Skipping process cleanup for debugging...');
    return Promise.resolve();
  }

  private async startServers(): Promise<void> {
    console.log('🏗️  Starting development servers...');
    
    // Start Cloudflare Worker
    const workerProcess = spawn('npm', ['run', 'worker:dev'], {
      stdio: ['ignore', 'inherit', 'inherit'], // Show all worker output
      shell: true
    });
    
    this.servers.push({
      process: workerProcess,
      port: 8787,
      name: 'Cloudflare Worker'
    });

    // Start Vite frontend  
    const frontendProcess = spawn('npm', ['run', 'dev'], {
      stdio: ['ignore', 'inherit', 'inherit'], // Show all frontend output
      shell: true
    });
    
    this.servers.push({
      process: frontendProcess,
      port: 3000,
      name: 'Vite Frontend'
    });

    // Log server outputs with limited verbosity
    let workerReady = false;
    let frontendReady = false;

    workerProcess.stdout?.on('data', (data) => {
      const output = data.toString().trim();
      if (output.includes('Ready on') && !workerReady) {
        console.log('⚡ Worker: Ready!');
        workerReady = true;
      } else if (!workerReady) {
        console.log('⚡ Worker:', output.split('\n')[0]); // Only first line
      }
    });

    frontendProcess.stdout?.on('data', (data) => {
      const output = data.toString().trim();
      if (output.includes('Local:') && !frontendReady) {
        console.log('🎨 Frontend: Ready!');
        frontendReady = true;
      } else if (!frontendReady) {
        console.log('🎨 Frontend:', output.split('\n')[0]); // Only first line
      }
    });

    // Give servers a moment to start before proceeding
    await this.sleep(2000);
  }

  private async waitForServers(): Promise<void> {
    console.log('⏳ Waiting for servers to be ready...');
    
    const maxAttempts = 15; // Reduced timeout
    let attempts = 0;

    while (attempts < maxAttempts) {
      attempts++;
      
      const serverChecks = this.servers.map(server => 
        this.checkServer(server.port, server.name)
      );
      
      const results = await Promise.all(serverChecks);
      
      if (results.every(result => result)) {
        console.log('✅ All servers are ready!');
        return;
      }
      
      console.log(`🔄 Attempt ${attempts}/${maxAttempts} - waiting for servers...`);
      await this.sleep(2000); // Check every 2 seconds
    }
    
    throw new Error('Servers failed to start within timeout period');
  }

  private checkServer(port: number, name: string): Promise<boolean> {
    return new Promise((resolve) => {
      const testReq = http.get(`http://localhost:${port}`, (res) => {
        resolve(true);
      });
      
      testReq.on('error', () => resolve(false));
      testReq.setTimeout(1000, () => {
        testReq.destroy();
        resolve(false);
      });
    });
  }

  private async runPlaywrightTests(): Promise<void> {
    return new Promise((resolve, reject) => {
      const playwright = spawn('npx', ['playwright', 'test'], {
        stdio: 'inherit',
        shell: true
      });

      // Add timeout for Playwright tests (5 minutes)
      const timeout = setTimeout(() => {
        console.log('⏰ Playwright tests timeout reached, killing process...');
        playwright.kill('SIGKILL');
        reject(new Error('Playwright tests timed out after 5 minutes'));
      }, 5 * 60 * 1000);

      playwright.on('close', (code) => {
        clearTimeout(timeout);
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`Playwright tests failed with exit code ${code}`));
        }
      });

      playwright.on('error', (error) => {
        clearTimeout(timeout);
        reject(new Error(`Failed to start Playwright: ${error.message}`));
      });
    });
  }

  private async cleanup(): Promise<void> {
    console.log('🧹 Cleaning up servers...');
    
    for (const server of this.servers) {
      if (server.process && !server.process.killed) {
        console.log(`Stopping ${server.name}...`);
        server.process.kill('SIGTERM');
        
        // Force kill after 5 seconds
        setTimeout(() => {
          if (!server.process.killed) {
            server.process.kill('SIGKILL');
          }
        }, 5000);
      }
    }
    
    await this.sleep(1000);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Run if called directly
if (import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/'))) {
  const runner = new E2ERunner();
  runner.run().catch(console.error);
} else {
  // Debug: Always run for now
  console.log('🚀 E2E Runner starting...');
  const runner = new E2ERunner();
  runner.run().catch(console.error);
}

export default E2ERunner;

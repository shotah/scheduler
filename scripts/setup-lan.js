#!/usr/bin/env node

/**
 * LAN Setup Helper
 * 
 * Automatically detects your LAN IP and creates .env file for multi-device testing
 */

import { execSync } from 'child_process';
import { promises as fs } from 'fs';
import { existsSync } from 'fs';

function getLanIP() {
  try {
    // Get IPv4 addresses, excluding loopback and Docker
    const command = 'ipconfig | findstr "IPv4" | findstr /V "127.0.0.1" | findstr /V "169.254" | findstr /V "172."';
    const output = execSync(command, { encoding: 'utf8' });
    
    const lines = output.split('\n').filter(line => line.trim());
    if (lines.length > 0) {
      const match = lines[0].match(/(\d+\.\d+\.\d+\.\d+)/);
      if (match && match[1]) {
        return match[1];
      }
    }
    
    return null;
  } catch (error) {
    console.error('Failed to detect LAN IP:', error.message);
    return null;
  }
}

async function createEnvFile(lanIP) {
  const envContent = `# Auto-generated LAN configuration for P2P testing
VITE_SIGNAL_URL=http://${lanIP}:8787

# Usage:
# - Run: npm start
# - Host device: http://${lanIP}:3000 
# - Other devices: http://${lanIP}:3000
# 
# Make sure Windows Firewall allows ports 3000 and 8787!
`;

  try {
    // Check if .env already exists
    if (existsSync('.env')) {
      const existing = await fs.readFile('.env', 'utf8');
      if (existing.includes('VITE_SIGNAL_URL')) {
        console.log('⚠️  .env file already exists with VITE_SIGNAL_URL');
        console.log('Current .env content:');
        console.log('---');
        console.log(existing);
        console.log('---');
        
        const backup = `.env.backup.${Date.now()}`;
        await fs.writeFile(backup, existing);
        console.log(`📄 Backed up existing .env to: ${backup}`);
      }
    }
    
    await fs.writeFile('.env', envContent);
    console.log('✅ Created .env file with LAN configuration');
    
  } catch (error) {
    console.error('❌ Failed to create .env file:', error.message);
    throw error;
  }
}

async function main() {
  console.log('🌐 Setting up LAN configuration for P2P testing...\n');
  
  const lanIP = getLanIP();
  
  if (!lanIP) {
    console.error('❌ Could not detect LAN IP address');
    console.log('\nManual setup:');
    console.log('1. Run: ipconfig');
    console.log('2. Find your WiFi/Ethernet IPv4 address (usually 192.168.x.x)');
    console.log('3. Create .env file with: VITE_SIGNAL_URL=http://YOUR_IP:8787');
    process.exit(1);
  }
  
  console.log('🔍 Detected LAN IP:', lanIP);
  
  await createEnvFile(lanIP);
  
  console.log('\n' + '='.repeat(60));
  console.log('🎉 LAN SETUP COMPLETE!');
  console.log('='.repeat(60));
  console.log(`\n📱 Access from any device on your network:`);
  console.log(`   Frontend: http://${lanIP}:3000`);
  console.log(`   Worker:   http://${lanIP}:8787`);
  
  console.log('\n🚀 Next steps:');
  console.log('   1. Run: npm start');
  console.log('   2. Open browser to: http://' + lanIP + ':3000');
  console.log('   3. Test P2P sync between devices!');
  
  console.log('\n🔥 Firewall reminder:');
  console.log('   Run as Administrator: debug-firewall-setup.bat');
}

main().catch(console.error);

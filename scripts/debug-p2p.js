#!/usr/bin/env node

/**
 * P2P Connection Debug Tool
 * 
 * This script helps validate and debug the P2P sync functionality
 * by testing network connectivity, firewall settings, and WebRTC capabilities.
 */

import { execSync } from 'child_process';
import { promises as fs } from 'fs';

const results = [];

function addResult(name, status, message, details) {
  results.push({ name, status, message, details });
}

function runCommand(command, description) {
  try {
    const output = execSync(command, { encoding: 'utf8', timeout: 5000 });
    addResult(description, 'PASS', 'Command executed successfully');
    return output.trim();
  } catch (error) {
    addResult(description, 'FAIL', `Command failed: ${error.message}`);
    return null;
  }
}

function checkPort(port, service) {
  const command = `netstat -an | findstr ":${port}"`;
  const output = runCommand(command, `Check ${service} port ${port}`);
  
  if (output && output.length > 0) {
    addResult(`Port ${port} Status`, 'PASS', `${service} port is active`);
  } else {
    addResult(`Port ${port} Status`, 'WARN', `${service} port not found - service may not be running`);
  }
}

function checkFirewallRule(ruleName) {
  const command = `netsh advfirewall firewall show rule name="${ruleName}"`;
  const output = runCommand(command, `Check firewall rule: ${ruleName}`);
  
  if (output && output.includes('Rule Name:')) {
    addResult(`Firewall Rule: ${ruleName}`, 'PASS', 'Firewall rule exists');
  } else {
    addResult(`Firewall Rule: ${ruleName}`, 'WARN', 'Firewall rule not found - may need to be created');
  }
}

function getNetworkInfo() {
  console.log('\n🌐 Network Configuration:');
  
  // Get network adapter info
  const ipCommand = 'ipconfig | findstr "IPv4"';
  const ipOutput = runCommand(ipCommand, 'Get local IP addresses');
  
  if (ipOutput) {
    const ips = ipOutput.split('\n').filter(line => line.trim());
    console.log('\n📍 Local IP Addresses:');
    ips.forEach(ip => {
      const match = ip.match(/(\d+\.\d+\.\d+\.\d+)/);
      if (match) {
        const address = match[1];
        if (address.startsWith('192.168.') || address.startsWith('10.') || address.startsWith('172.')) {
          console.log(`   🏠 LAN IP: ${address} (Use this for other devices)`);
        } else if (address !== '127.0.0.1') {
          console.log(`   🌍 Other IP: ${address}`);
        }
      }
    });
  }
}

function checkWebRTCPorts() {
  console.log('\n🔍 Checking WebRTC Port Range (49152-65535):');
  
  // Check for active connections in WebRTC range
  const webrtcCommand = 'netstat -an | findstr ":49" | findstr "UDP"';
  const output = runCommand(webrtcCommand, 'Check WebRTC UDP ports');
  
  if (output && output.length > 0) {
    const lines = output.split('\n').filter(line => line.trim());
    addResult('WebRTC Ports', 'PASS', `Found ${lines.length} active WebRTC ports`);
    console.log(`   📊 Active WebRTC connections: ${lines.length}`);
  } else {
    addResult('WebRTC Ports', 'WARN', 'No active WebRTC ports found - may indicate connection issues');
  }
}

async function generateFirewallCommands() {
  const commands = [
    '# Run these commands as Administrator to allow P2P connections:',
    '',
    '# Allow Vite dev server',
    'netsh advfirewall firewall add rule name="Vite Dev Server" dir=in action=allow protocol=TCP localport=3000',
    '',
    '# Allow Cloudflare Worker dev',
    'netsh advfirewall firewall add rule name="Cloudflare Worker Dev" dir=in action=allow protocol=TCP localport=8787',
    '',
    '# Allow WebRTC P2P connections',
    'netsh advfirewall firewall add rule name="WebRTC P2P UDP" dir=in action=allow protocol=UDP localportrange=49152-65535',
    'netsh advfirewall firewall add rule name="WebRTC P2P TCP" dir=in action=allow protocol=TCP localportrange=49152-65535',
    '',
    '# Test firewall rules',
    'netsh advfirewall firewall show rule name="WebRTC P2P UDP"',
    'netsh advfirewall firewall show rule name="Vite Dev Server"',
  ];
  
  await fs.writeFile('debug-firewall-setup.bat', commands.join('\n'));
  console.log('\n📄 Generated firewall setup script: debug-firewall-setup.bat');
  addResult('Firewall Script', 'PASS', 'Generated firewall setup commands');
}

function printResults() {
  console.log('\n' + '='.repeat(60));
  console.log('🔍 P2P CONNECTION DEBUG RESULTS');
  console.log('='.repeat(60));
  
  const passed = results.filter(r => r.status === 'PASS').length;
  const failed = results.filter(r => r.status === 'FAIL').length;
  const warnings = results.filter(r => r.status === 'WARN').length;
  
  console.log(`\n📊 Summary: ${passed} passed, ${failed} failed, ${warnings} warnings\n`);
  
  results.forEach(result => {
    const icon = result.status === 'PASS' ? '✅' : result.status === 'FAIL' ? '❌' : '⚠️';
    console.log(`${icon} ${result.name}: ${result.message}`);
    if (result.details) {
      console.log(`   ${result.details}`);
    }
  });
  
  console.log('\n' + '='.repeat(60));
  console.log('🛠️  NEXT STEPS:');
  console.log('='.repeat(60));
  
  if (failed > 0) {
    console.log('❌ Critical issues found:');
    console.log('   1. Run: npm start (to start both services)');
    console.log('   2. Run debug-firewall-setup.bat as Administrator');
    console.log('   3. Restart browsers and try again');
  } else if (warnings > 0) {
    console.log('⚠️  Potential issues detected:');
    console.log('   1. Check if services are running: npm start');
    console.log('   2. Consider running firewall setup script');
    console.log('   3. Test P2P connection with two browser tabs');
  } else {
    console.log('🎉 All checks passed! Your P2P setup looks good.');
    console.log('   1. Open two browser tabs to localhost:3000');
    console.log('   2. Host a room in one tab');
    console.log('   3. Join the room from the other tab');
    console.log('   4. Check browser console (F12) for detailed logs');
  }
  
  console.log('\n📖 For detailed debugging info, see:');
  console.log('   - PURE_P2P_ARCHITECTURE.md');
  console.log('   - Browser DevTools console (F12)');
}

async function main() {
  console.log('🚀 Starting P2P Connection Debug...\n');
  
  // Basic system checks
  getNetworkInfo();
  
  // Check required ports
  checkPort(3000, 'Vite Dev Server');
  checkPort(8787, 'Cloudflare Worker');
  
  // Check WebRTC ports
  checkWebRTCPorts();
  
  // Check firewall rules
  checkFirewallRule('Vite Dev Server');
  checkFirewallRule('Cloudflare Worker Dev');
  checkFirewallRule('WebRTC P2P UDP');
  checkFirewallRule('WebRTC P2P TCP');
  
  // Generate helper scripts
  await generateFirewallCommands();
  
  // Show results
  printResults();
}

main().catch(console.error);

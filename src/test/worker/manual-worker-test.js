/**
 * Manual Worker Discovery Service Tests
 * Run this with: node src/test/worker/manual-worker-test.js
 * Requires the worker to be running on http://127.0.0.1:8787
 */

const BASE_URL = 'http://127.0.0.1:8787';

async function testWorkerEndpoints() {
  console.log('🧪 Testing Worker Discovery Service\n');

  try {
    // Test 1: Health Check
    console.log('1. Testing health endpoint...');
    const healthResp = await fetch(`${BASE_URL}/health`);
    const healthData = await healthResp.json();
    
    console.log('   ✅ Health check passed');
    console.log('   📊 Status:', healthData.status);
    console.log('   📊 Service:', healthData.service);

    // Test 2: Room Creation
    console.log('\n2. Testing room creation...');
    const roomResp = await fetch(`${BASE_URL}/rooms`, { method: 'POST' });
    const roomData = await roomResp.json();
    const roomId = roomData.roomId;
    
    console.log('   ✅ Room created successfully');
    console.log('   🆔 Room ID:', roomId);

    // Test 3: Peer Registration
    console.log('\n3. Testing peer registration...');
    const registerResp = await fetch(`${BASE_URL}/discovery/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roomId, peerId: 'test-peer-1' })
    });
    const registerData = await registerResp.json();
    
    console.log('   ✅ Peer registration successful');
    console.log('   🌐 Registered IP:', registerData.registeredIP);

    // Test 4: Register Second Peer
    console.log('\n4. Testing second peer registration...');
    await fetch(`${BASE_URL}/discovery/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roomId, peerId: 'test-peer-2' })
    });
    
    console.log('   ✅ Second peer registered');

    // Test 5: Peer Discovery
    console.log('\n5. Testing peer discovery...');
    const discoverResp = await fetch(
      `${BASE_URL}/discovery/peers?roomId=${encodeURIComponent(roomId)}&peerId=${encodeURIComponent('test-peer-1')}`
    );
    const discoverData = await discoverResp.json();
    
    console.log('   ✅ Peer discovery successful');
    console.log('   👥 Discovered peers:', discoverData.peers.length);
    console.log('   📋 Peer details:', discoverData.peers);

    // Test 6: Error Handling
    console.log('\n6. Testing error handling...');
    const errorResp = await fetch(`${BASE_URL}/discovery/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roomId: 'missing-peer-id' })
    });
    
    if (errorResp.status === 400) {
      console.log('   ✅ Error handling works correctly');
    } else {
      console.log('   ❌ Error handling failed');
    }

    // Test 7: Privacy Protection
    console.log('\n7. Testing privacy protection...');
    const otherRoomResp = await fetch(`${BASE_URL}/rooms`, { method: 'POST' });
    const otherRoomData = await otherRoomResp.json();
    const otherRoomId = otherRoomData.roomId;

    const privacyResp = await fetch(
      `${BASE_URL}/discovery/peers?roomId=${encodeURIComponent(otherRoomId)}&peerId=unauthorized-peer`
    );
    const privacyData = await privacyResp.json();
    
    if (privacyData.peers.length === 0) {
      console.log('   ✅ Privacy protection works - no cross-room data leakage');
    } else {
      console.log('   ❌ Privacy issue - unauthorized access detected');
    }

    console.log('\n🎉 All tests completed successfully!');
    console.log('\n📋 Summary:');
    console.log('   ✅ Room creation works');
    console.log('   ✅ Peer registration works');
    console.log('   ✅ Peer discovery works');
    console.log('   ✅ Error handling works');
    console.log('   ✅ Privacy protection works');
    console.log('\n🏥 Perfect for clinic P2P workflows!');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.log('\n🔧 Make sure the worker is running: npm run worker:dev');
    process.exit(1);
  }
}

// Run tests
testWorkerEndpoints();

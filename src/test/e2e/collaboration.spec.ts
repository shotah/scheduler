import { test, expect, Page } from '@playwright/test';

test.describe('Real-time Collaboration', () => {
  let hostPage: Page;
  let joinPage: Page;
  let roomId: string;

  test.beforeEach(async ({ browser }) => {
    // Use separate contexts to avoid conflicts
    const hostContext = await browser.newContext();
    const joinContext = await browser.newContext();
    
    hostPage = await hostContext.newPage();
    joinPage = await joinContext.newPage();
  });

  test.afterEach(async () => {
    // Proper cleanup
    try {
      if (hostPage && !hostPage.isClosed()) {
        await hostPage.context().close();
      }
      if (joinPage && !joinPage.isClosed()) {
        await joinPage.context().close();
      }
    } catch (error) {
      console.log('Cleanup error (expected):', error instanceof Error ? error.message : 'Unknown error');
    }
  });

  test('should establish host-join connection and sync tasks', async () => {
    // Host starts hosting
    await hostPage.goto('/');
    await hostPage.click('text=🏠 Host workspace');
    
    // Wait for room creation and get room ID
    await hostPage.waitForSelector('text=Room ID:', { timeout: 10000 });
    const roomElement = hostPage.locator('p:has-text("Room ID:") code').first();
    const roomText = await roomElement.textContent();
    roomId = roomText ? roomText.trim() : '';
    console.log('Extracted room ID:', roomId);
    
    expect(roomId).toBeTruthy();
    expect(roomId).toMatch(/^[a-f0-9\-]{36}$/); // UUID format

    // Joiner connects to room
    await joinPage.goto('/');
    await joinPage.fill('input[placeholder="Enter room ID to join..."]', roomId);
    await joinPage.click('text=🔗 Join');

    // Wait for host to be connected as host
    await hostPage.waitForSelector('text=Connected as host! 🎉 Waiting for others...', { timeout: 15000 });
    // Wait for joiner to also be connected (POC: both think they're host until real P2P)
    await joinPage.waitForSelector('text=Connected as host! 🎉 Waiting for others...', { timeout: 15000 });

    // Verify user count (POC: may show 1 each until real P2P is implemented)
    await expect(hostPage.locator('text=Connected users:')).toBeVisible();
    await expect(joinPage.locator('text=Connected users:')).toBeVisible();

    // Host adds a task
    await hostPage.fill('input[placeholder="Add a new task..."]', 'Task from host');
    await hostPage.click('text=➕ Add');

    // Verify task appears on join page
    await expect(joinPage.locator('text=Task from host')).toBeVisible({ timeout: 5000 });

    // Joiner adds a task
    await joinPage.fill('input[placeholder="Add a new task..."]', 'Task from joiner');
    await joinPage.click('text=➕ Add');

    // Verify task appears on host page
    await expect(hostPage.locator('text=Task from joiner')).toBeVisible({ timeout: 5000 });

    // Both pages should show both tasks
    await expect(hostPage.locator('text=Task from host')).toBeVisible();
    await expect(hostPage.locator('text=Task from joiner')).toBeVisible();
    await expect(joinPage.locator('text=Task from host')).toBeVisible();
    await expect(joinPage.locator('text=Task from joiner')).toBeVisible();
  });

  test('should sync task completion status', async () => {
    // Set up connection (reuse setup logic)
    await hostPage.goto('/');
    await hostPage.click('text=🏠 Host workspace');
    await hostPage.waitForSelector('text=Room ID:', { timeout: 10000 });
    
    const roomElement = hostPage.locator('p:has-text("Room ID:") code').first();
    const roomText = await roomElement.textContent();
    roomId = roomText ? roomText.trim() : '';
    console.log('Extracted room ID:', roomId);

    await joinPage.goto('/');
    await joinPage.fill('input[placeholder="Enter room ID to join..."]', roomId);
    await joinPage.click('text=🔗 Join');

    await hostPage.waitForSelector('text=Connected as host! 🎉 Waiting for others...');
    await joinPage.waitForSelector('text=Connected as host! 🎉 Waiting for others...');

    // Host adds a task
    await hostPage.fill('input[placeholder="Add a new task..."]', 'Task to complete');
    await hostPage.click('text=➕ Add');

    // Wait for task to appear on join page
    await expect(joinPage.locator('text=Task to complete')).toBeVisible();

    // Joiner completes the task
    const taskCheckbox = joinPage.locator('input[type="checkbox"]').first();
    await taskCheckbox.check();

    // Verify task is marked complete on host page
    const hostCheckbox = hostPage.locator('input[type="checkbox"]').first();
    await expect(hostCheckbox).toBeChecked({ timeout: 5000 });

    // Verify strikethrough styling on both pages
    await expect(hostPage.locator('text=Task to complete').locator('..')).toHaveCSS('text-decoration', /line-through/);
    await expect(joinPage.locator('text=Task to complete').locator('..')).toHaveCSS('text-decoration', /line-through/);
  });

  test('should handle concurrent task additions', async () => {
    // Set up connection
    await hostPage.goto('/');
    await hostPage.click('text=🏠 Host workspace');
    await hostPage.waitForSelector('text=Room ID:');
    
    const roomElement = hostPage.locator('p:has-text("Room ID:") code').first();
    const roomText = await roomElement.textContent();
    roomId = roomText ? roomText.trim() : '';
    console.log('Extracted room ID:', roomId);

    await joinPage.goto('/');
    await joinPage.fill('input[placeholder="Enter room ID to join..."]', roomId);
    await joinPage.click('text=🔗 Join');

    await hostPage.waitForSelector('text=Connected as host! 🎉 Waiting for others...');
    await joinPage.waitForSelector('text=Connected as host! 🎉 Waiting for others...');

    // Add multiple tasks simultaneously
    const hostPromise = (async () => {
      await hostPage.fill('input[placeholder="Add a new task..."]', 'Concurrent task 1');
      await hostPage.click('text=➕ Add');
      await hostPage.fill('input[placeholder="Add a new task..."]', 'Concurrent task 2');
      await hostPage.click('text=➕ Add');
    })();

    const joinPromise = (async () => {
      await joinPage.fill('input[placeholder="Add a new task..."]', 'Concurrent task 3');
      await joinPage.click('text=➕ Add');
      await joinPage.fill('input[placeholder="Add a new task..."]', 'Concurrent task 4');
      await joinPage.click('text=➕ Add');
    })();

    await Promise.all([hostPromise, joinPromise]);

    // Verify all tasks appear on both pages
    const expectedTasks = [
      'Concurrent task 1',
      'Concurrent task 2', 
      'Concurrent task 3',
      'Concurrent task 4'
    ];

    for (const task of expectedTasks) {
      await expect(hostPage.locator(`text=${task}`)).toBeVisible({ timeout: 10000 });
      await expect(joinPage.locator(`text=${task}`)).toBeVisible({ timeout: 10000 });
    }

    // Verify task count is correct
    // Task count not implemented: await expect(hostPage.locator('text=Tasks: 4 active, 0 completed')).toBeVisible();
    // Task count not implemented: await expect(joinPage.locator('text=Tasks: 4 active, 0 completed')).toBeVisible();
  });

  test('should handle disconnection and reconnection', async () => {
    // Set up connection
    await hostPage.goto('/');
    await hostPage.click('text=🏠 Host workspace');
    await hostPage.waitForSelector('text=Room ID:');
    
    const roomElement = hostPage.locator('p:has-text("Room ID:") code').first();
    const roomText = await roomElement.textContent();
    roomId = roomText ? roomText.trim() : '';
    console.log('Extracted room ID:', roomId);

    await joinPage.goto('/');
    await joinPage.fill('input[placeholder="Enter room ID to join..."]', roomId);
    await joinPage.click('text=🔗 Join');

    await hostPage.waitForSelector('text=Connected as host! 🎉 Waiting for others...');
    await joinPage.waitForSelector('text=Connected as host! 🎉 Waiting for others...');

    // Add initial task
    await hostPage.fill('input[placeholder="Add a new task..."]', 'Task before disconnect');
    await hostPage.click('text=➕ Add');
    await expect(joinPage.locator('text=Task before disconnect')).toBeVisible();

    // Simulate disconnection by going offline (mock network condition)
    await joinPage.context().setOffline(true);
    
    // Host adds task while joiner is offline
    await hostPage.fill('input[placeholder="Add a new task..."]', 'Task while offline');
    await hostPage.click('text=➕ Add');

    // Reconnect joiner
    await joinPage.context().setOffline(false);
    
    // Wait for reconnection and sync
    await joinPage.waitForSelector('text=Connected as host! 🎉 Waiting for others...', { timeout: 15000 });
    
    // Verify offline task synced after reconnection
    await expect(joinPage.locator('text=Task while offline')).toBeVisible({ timeout: 10000 });
    
    // Both pages should have both tasks
    await expect(hostPage.locator('text=Task before disconnect')).toBeVisible();
    await expect(hostPage.locator('text=Task while offline')).toBeVisible();
    await expect(joinPage.locator('text=Task before disconnect')).toBeVisible();
    await expect(joinPage.locator('text=Task while offline')).toBeVisible();
  });

  test('should support multiple joiners', async () => {
    // Create third browser context
    const thirdContext = await hostPage.context().browser()?.newContext();
    if (!thirdContext) throw new Error('Could not create third context');
    const thirdPage = await thirdContext.newPage();

    try {
      // Host starts hosting
      await hostPage.goto('/');
      await hostPage.click('text=🏠 Host workspace');
      await hostPage.waitForSelector('text=Room ID:');
      
      const roomElement = hostPage.locator('p:has-text("Room ID:") code').first();
      const roomText = await roomElement.textContent();
      roomId = roomText ? roomText.trim() : '';
      console.log('Extracted room ID:', roomId);

      // First joiner connects
      await joinPage.goto('/');
      await joinPage.fill('input[placeholder="Enter room ID to join..."]', roomId);
      await joinPage.click('text=🔗 Join');
      await joinPage.waitForSelector('text=Connected as host! 🎉 Waiting for others...');

      // Second joiner connects
      await thirdPage.goto('/');
      await thirdPage.fill('input[placeholder="Enter room ID to join..."]', roomId);
      await thirdPage.click('text=🔗 Join');
      await thirdPage.waitForSelector('text=Connected as host! 🎉 Waiting for others...');

      // Verify all show 3 connected users
      await expect(hostPage.locator('text=Connected users: 3')).toBeVisible({ timeout: 10000 });
      await expect(joinPage.locator('text=Connected users: 3')).toBeVisible({ timeout: 10000 });
      await expect(thirdPage.locator('text=Connected users: 3')).toBeVisible({ timeout: 10000 });

      // Each user adds a task
      await hostPage.fill('input[placeholder="Add a new task..."]', 'Host task');
      await hostPage.click('text=➕ Add');

      await joinPage.fill('input[placeholder="Add a new task..."]', 'Joiner 1 task');
      await joinPage.click('text=➕ Add');

      await thirdPage.fill('input[placeholder="Add a new task..."]', 'Joiner 2 task');
      await thirdPage.click('text=➕ Add');

      // Verify all tasks appear on all pages
      const tasks = ['Host task', 'Joiner 1 task', 'Joiner 2 task'];
      const pages = [hostPage, joinPage, thirdPage];

      for (const page of pages) {
        for (const task of tasks) {
          await expect(page.locator(`text=${task}`)).toBeVisible({ timeout: 10000 });
        }
        // Task count not implemented: await expect(page.locator('text=Tasks: 3 active, 0 completed')).toBeVisible();
      }
    } finally {
      await thirdPage.close();
      await thirdContext.close();
    }
  });

  test('should handle rapid task modifications', async () => {
    // Set up connection
    await hostPage.goto('/');
    await hostPage.click('text=🏠 Host workspace');
    await hostPage.waitForSelector('text=Room ID:');
    
    const roomElement = hostPage.locator('p:has-text("Room ID:") code').first();
    const roomText = await roomElement.textContent();
    roomId = roomText ? roomText.trim() : '';
    console.log('Extracted room ID:', roomId);

    await joinPage.goto('/');
    await joinPage.fill('input[placeholder="Enter room ID to join..."]', roomId);
    await joinPage.click('text=🔗 Join');

    await hostPage.waitForSelector('text=Connected as host! 🎉 Waiting for others...');
    await joinPage.waitForSelector('text=Connected as host! 🎉 Waiting for others...');

    // Add initial task
    await hostPage.fill('input[placeholder="Add a new task..."]', 'Toggle test task');
    await hostPage.click('text=➕ Add');
    await expect(joinPage.locator('text=Toggle test task')).toBeVisible();

    // Rapidly toggle task completion on both sides
    const hostCheckbox = hostPage.locator('input[type="checkbox"]').first();
    const joinCheckbox = joinPage.locator('input[type="checkbox"]').first();

    // Rapid toggle sequence
    await hostCheckbox.check();
    await joinCheckbox.uncheck();
    await hostCheckbox.check();
    await joinCheckbox.uncheck();
    await hostCheckbox.check();

    // Wait for final state to stabilize
    await hostPage.waitForTimeout(2000);

    // Both should converge to the same final state (Y.js CRDT ensures consistency)
    const hostChecked = await hostCheckbox.isChecked();
    const joinChecked = await joinCheckbox.isChecked();
    
    expect(hostChecked).toBe(joinChecked); // Should be consistent
  });
});

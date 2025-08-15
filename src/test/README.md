# Testing Guide

This project uses a comprehensive testing strategy with multiple testing layers to ensure reliability and quality.

## Testing Stack

- **Jest** - Unit and integration tests
- **@testing-library/react** - Component testing utilities  
- **Playwright** - End-to-end testing
- **Wrangler** - Cloudflare Worker testing

## Test Structure

```bash
src/test/
├── setup.ts                    # Test environment setup
├── e2e/                        # End-to-end tests (Playwright)
│   ├── basic-functionality.spec.ts
│   └── collaboration.spec.ts
├── integration/                # Integration tests
│   └── signaling.test.ts
└── worker/                     # Worker-specific tests
    └── worker.test.ts

src/hooks/__tests__/            # Hook unit tests
├── useYjsCollaboration.test.ts
└── useSessionManager.test.ts

src/components/__tests__/       # Component unit tests
├── TaskList.test.tsx
├── ConnectionStatus.test.tsx
└── RoomControls.test.tsx
```

## Running Tests

### All Tests
```bash
npm run test:all          # Run all tests (unit + e2e)
```


### Unit & Integration Tests

```bash
npm test                  # Run Jest tests once
npm run test:watch        # Run Jest in watch mode
npm run test:coverage     # Run with coverage report
```


### End-to-End Tests

```bash
npm run test:e2e          # Run Playwright tests
npm run test:e2e:ui       # Run with Playwright UI
npm run test:setup        # Install Playwright browsers
```

## Test Categories

### Unit Tests

**Hook Tests** (`src/hooks/__tests__/`)

- `useYjsCollaboration.test.ts` - Y.js collaboration logic
- `useSessionManager.test.ts` - Session persistence logic

**Component Tests** (`src/components/__tests__/`)

- `TaskList.test.tsx` - Task management UI
- `ConnectionStatus.test.tsx` - Connection status display
- `RoomControls.test.tsx` - Room control interface

### Integration Tests

**Signaling Tests** (`src/test/integration/`)

- Tests client-worker communication
- Room creation and management
- Error handling and network conditions

### Worker Tests

**Worker Unit Tests** (`src/test/worker/`)

- WebSocket relay functionality
- Room state management
- CORS compliance
- Security and performance

### End-to-End Tests

**Basic Functionality** (`src/test/e2e/basic-functionality.spec.ts`)

- Application loading and UI
- Single-user task management
- Session persistence
- Accessibility

**Collaboration** (`src/test/e2e/collaboration.spec.ts`)

- Multi-user real-time sync
- Connection/disconnection handling
- Concurrent task modifications
- Y.js CRDT conflict resolution

## Test Coverage

### Coverage Targets
- **Branches**: 80%
- **Functions**: 80%
- **Lines**: 80%
- **Statements**: 80%


### Coverage Reports

```bash
npm run test:coverage     # Generate coverage report
open coverage/lcov-report/index.html  # View in browser
```

## Testing Best Practices

### Unit Tests
- Test pure functions and isolated components
- Mock external dependencies (WebSocket, Y.js)
- Use `@testing-library/react` for component testing
- Focus on behavior, not implementation


### Integration Tests
- Test real worker-client communication
- Use actual Cloudflare Worker instances
- Test error conditions and edge cases
- Verify CORS and security policies


### E2E Tests
- Test complete user workflows
- Use multiple browser contexts for collaboration
- Test real-time synchronization
- Verify accessibility and keyboard navigation

## Mock Strategy

### Global Mocks (`src/test/setup.ts`)
```typescript
// WebSocket API
global.WebSocket = jest.fn().mockImplementation(...)

// Crypto API
Object.defineProperty(global, 'crypto', ...)

// LocalStorage
Object.defineProperty(window, 'localStorage', ...)
```


### Test-Specific Mocks
- Y.js document and provider mocking
- Clipboard API mocking
- Network condition simulation
- Timer and delay mocking

## Debugging Tests

### Jest Tests
```bash
npm test -- --verbose         # Verbose output
npm test -- --detectOpenHandles  # Find resource leaks
npm test -- --runInBand       # Run serially for debugging
```


### Playwright Tests
```bash
npm run test:e2e -- --debug   # Debug mode
npm run test:e2e -- --headed  # Run with browser visible
npm run test:e2e:ui           # Interactive UI mode
```

## Continuous Integration

### Test Pipeline
1. **Unit Tests** - Fast feedback on component logic
2. **Integration Tests** - Verify worker communication
3. **E2E Tests** - Full workflow validation
4. **Coverage Report** - Ensure quality standards


### Pre-commit Hooks
```bash
npm test                      # Run all unit tests
npm run test:e2e             # Run critical E2E tests
```

## Common Testing Scenarios

### Testing Y.js Collaboration
```typescript
// Mock Y.js document
const mockYDoc = { getArray: jest.fn(() => mockYArray) };
const mockYArray = { 
  toArray: jest.fn(() => []),
  push: jest.fn(),
  observe: jest.fn() 
};
```


### Testing WebSocket Connections
```typescript
// Mock WebSocket provider
const mockProvider = {
  on: jest.fn(),
  destroy: jest.fn(),
  awareness: { getStates: jest.fn(() => new Map()) }
};
```


### Testing Multi-User Scenarios
```typescript
// Create multiple browser contexts
const hostContext = await browser.newContext();
const joinContext = await browser.newContext();
const hostPage = await hostContext.newPage();
const joinPage = await joinContext.newPage();
```

## Performance Testing

### Metrics Tracked
- Test execution time
- Memory usage during tests
- WebSocket connection stability
- Y.js synchronization speed


### Benchmarks
- Room creation: < 2000ms
- Task synchronization: < 100ms
- E2E test suite: < 5 minutes
- Unit test suite: < 30 seconds

## Troubleshooting

### Common Issues

**Tests timing out**
- Increase timeout values for E2E tests
- Check WebSocket connection stability
- Verify worker is properly started


#### Y.js mock issues
- Ensure proper Y.js module mocking
- Check observer callback invocation
- Verify document lifecycle management


#### Playwright browser issues
- Run `npm run test:setup` to install browsers
- Check for port conflicts (3001, 8787)
- Verify worker is accessible from test context


### Debug Commands
```bash
# Check test environment
npm run test -- --listTests

# Run single test file
npm test -- useYjsCollaboration.test.ts

# Run specific E2E test
npm run test:e2e -- --grep "should sync tasks"

# Generate detailed coverage
npm run test:coverage -- --verbose
```

## Future Testing Enhancements

### Planned Additions
- Visual regression testing for UI components
- Performance benchmarking in CI
- Cross-browser compatibility testing
- Mobile device testing with Playwright
- Stress testing for high user counts
- Security penetration testing


### Tools to Consider
- **Storybook** for component documentation and testing
- **MSW** for more sophisticated API mocking
- **Lighthouse CI** for performance monitoring
- **Axe** for automated accessibility testing

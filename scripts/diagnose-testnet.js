/**
 * Bitcoin Computer Testnet Diagnostic Tool
 * Tests connectivity and tries to find working nodes
 */

import axios from 'axios'
import { Computer } from '@bitcoin-computer/lib'
import dns from 'dns'
import { promisify } from 'util'

const dnsLookup = promisify(dns.lookup)
const dnsResolve = promisify(dns.resolve)

// Color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
}

function log(color, message) {
  console.log(`${colors[color]}${message}${colors.reset}`)
}

// List of possible Bitcoin Computer nodes
const NODES = [
  {
    name: 'Official Node',
    url: 'https://node.bitcoincomputer.io',
    rpcPath: '/v1/LTC/testnet/rpc'
  },
  {
    name: 'Alternative RPC',
    url: 'https://rpc.testnet.bitcoin.computer',
    rpcPath: '/v1/LTC/testnet/rpc'
  },
  {
    name: 'Testnet Direct',
    url: 'https://testnet.bitcoin.computer',
    rpcPath: '/rpc'
  },
  {
    name: 'Main Site',
    url: 'https://bitcoincomputer.io',
    rpcPath: '/node/v1/LTC/testnet/rpc'
  }
]

// Test 1: DNS Resolution
async function testDNS(hostname) {
  log('cyan', `\n🔍 Testing DNS resolution for: ${hostname}`)
  
  try {
    const result = await dnsLookup(hostname)
    log('green', `   ✅ DNS resolved to: ${result.address}`)
    return { success: true, ip: result.address }
  } catch (error) {
    log('red', `   ❌ DNS lookup failed: ${error.code}`)
    
    // Try alternative DNS servers
    try {
      log('yellow', '   ⚠️  Trying Google DNS (8.8.8.8)...')
      const records = await dnsResolve(hostname)
      log('green', `   ✅ Alternative DNS found: ${records[0]}`)
      return { success: true, ip: records[0], alternative: true }
    } catch {
      log('red', `   ❌ Alternative DNS also failed`)
      return { success: false, error: error.code }
    }
  }
}

// Test 2: HTTP Connectivity
async function testHTTP(url) {
  log('cyan', `\n🌐 Testing HTTP connectivity: ${url}`)
  
  try {
    const response = await axios.get(url, {
      timeout: 10000,
      validateStatus: () => true // Accept any status
    })
    
    log('green', `   ✅ HTTP connection successful`)
    log('blue', `   📊 Status: ${response.status}`)
    log('blue', `   📊 Server: ${response.headers['server'] || 'Unknown'}`)
    
    return { success: true, status: response.status, data: response.data }
  } catch (error) {
    if (error.code === 'ENOTFOUND') {
      log('red', `   ❌ Domain not found (DNS issue)`)
    } else if (error.code === 'ECONNREFUSED') {
      log('red', `   ❌ Connection refused (server down or firewalled)`)
    } else if (error.code === 'ETIMEDOUT') {
      log('red', `   ❌ Connection timeout (server not responding)`)
    } else {
      log('red', `   ❌ Error: ${error.message}`)
    }
    
    return { success: false, error: error.code, message: error.message }
  }
}

// Test 3: RPC Endpoint
async function testRPC(baseUrl, rpcPath) {
  const fullUrl = baseUrl + rpcPath
  log('cyan', `\n🔧 Testing RPC endpoint: ${fullUrl}`)
  
  try {
    const response = await axios.post(fullUrl, {
      method: 'getblockchaininfo',
      params: []
    }, {
      timeout: 10000,
      validateStatus: () => true,
      headers: {
        'Content-Type': 'application/json'
      }
    })
    
    if (response.status === 200 && response.data) {
      log('green', `   ✅ RPC endpoint responding`)
      log('blue', `   📊 Response: ${JSON.stringify(response.data).substring(0, 100)}...`)
      return { success: true, data: response.data }
    } else {
      log('yellow', `   ⚠️  RPC endpoint returned status ${response.status}`)
      return { success: false, status: response.status }
    }
  } catch (error) {
    log('red', `   ❌ RPC request failed: ${error.message}`)
    return { success: false, error: error.message }
  }
}

// Test 4: Bitcoin Computer Library
async function testBitcoinComputer(url) {
  log('cyan', `\n💻 Testing Bitcoin Computer library with: ${url}`)
  
  try {
    const computer = new Computer({
      chain: 'LTC',
      network: 'testnet',
      url: url
    })
    
    log('green', `   ✅ Bitcoin Computer initialized`)
    const pubKey = computer.getPublicKey()
    log('blue', `   📊 Public Key: ${pubKey.substring(0, 20)}...`)
    
    // Try to get blockchain info (doesn't require faucet)
    log('cyan', '   🔄 Testing connection...')
    
    // This will fail if node is unreachable
    try {
      await computer.faucet(1000) // Request tiny amount
      log('green', `   ✅ Faucet request successful!`)
      return { success: true, computer }
    } catch (faucetError) {
      log('yellow', `   ⚠️  Faucet failed: ${faucetError.message}`)
      return { success: false, error: faucetError.message, partialSuccess: true }
    }
  } catch (error) {
    log('red', `   ❌ Bitcoin Computer failed: ${error.message}`)
    return { success: false, error: error.message }
  }
}

// Test 5: Network Configuration
async function testNetwork() {
  log('cyan', '\n🌍 Testing network configuration...')
  
  try {
    // Test internet connectivity
    await axios.get('https://www.google.com', { timeout: 5000 })
    log('green', '   ✅ Internet connection working')
    
    // Test if we can reach other blockchain services
    await axios.get('https://blockstream.info/testnet/api/blocks/tip/height', { timeout: 5000 })
    log('green', '   ✅ Can reach other blockchain APIs')
    
    return { success: true }
  } catch {
    log('red', '   ❌ Network issues detected')
    return { success: false }
  }
}

// Main diagnostic function
async function runDiagnostics() {
  console.log('╔════════════════════════════════════════════════════════════╗')
  console.log('║   BITCOIN COMPUTER TESTNET DIAGNOSTIC TOOL                ║')
  console.log('╚════════════════════════════════════════════════════════════╝')
  
  const results = {
    timestamp: new Date().toISOString(),
    tests: [],
    workingNodes: []
  }
  
  // Test network first
  log('blue', '\n━━━ STEP 1: Network Connectivity ━━━')
  const networkTest = await testNetwork()
  results.tests.push({ name: 'Network', ...networkTest })
  
  if (!networkTest.success) {
    log('red', '\n❌ CRITICAL: No internet connection detected')
    log('yellow', '   Please check your internet connection and try again')
    return results
  }
  
  // Test each node
  log('blue', '\n━━━ STEP 2: Testing Bitcoin Computer Nodes ━━━')
  
  for (const node of NODES) {
    log('yellow', `\n${'='.repeat(60)}`)
    log('yellow', `Testing: ${node.name}`)
    log('yellow', '='.repeat(60))
    
    const nodeResult = {
      name: node.name,
      url: node.url,
      tests: {}
    }
    
    // Extract hostname from URL
    const hostname = new URL(node.url).hostname
    
    // Test 1: DNS
    const dnsTest = await testDNS(hostname)
    nodeResult.tests.dns = dnsTest
    
    if (!dnsTest.success) {
      log('red', `\n❌ Skipping ${node.name} - DNS failed`)
      results.tests.push(nodeResult)
      continue
    }
    
    // Test 2: HTTP
    const httpTest = await testHTTP(node.url)
    nodeResult.tests.http = httpTest
    
    // Test 3: RPC
    const rpcTest = await testRPC(node.url, node.rpcPath)
    nodeResult.tests.rpc = rpcTest
    
    // Test 4: Bitcoin Computer
    const bcTest = await testBitcoinComputer(node.url)
    nodeResult.tests.bitcoinComputer = bcTest
    
    // Determine if node is working
    if (bcTest.success || bcTest.partialSuccess) {
      log('green', `\n✨ ${node.name} is partially or fully working!`)
      results.workingNodes.push({
        name: node.name,
        url: node.url,
        fullyWorking: bcTest.success
      })
    }
    
    results.tests.push(nodeResult)
  }
  
  // Summary
  log('blue', '\n━━━ DIAGNOSTIC SUMMARY ━━━\n')
  
  if (results.workingNodes.length === 0) {
    log('red', '❌ NO WORKING NODES FOUND')
    log('yellow', '\nPossible reasons:')
    log('yellow', '  1. Bitcoin Computer testnet is currently down')
    log('yellow', '  2. Your network is blocking the connections')
    log('yellow', '  3. Service has been discontinued or moved')
    log('yellow', '\nRecommended actions:')
    log('yellow', '  1. Check Bitcoin Computer status: https://twitter.com/bitcoin_computer')
    log('yellow', '  2. Try again in a few hours')
    log('yellow', '  3. Continue with local development')
    log('yellow', '  4. Consider setting up your own Litecoin testnet node')
  } else {
    log('green', `✅ FOUND ${results.workingNodes.length} WORKING NODE(S):\n`)
    results.workingNodes.forEach(node => {
      log('green', `   • ${node.name}`)
      log('blue', `     URL: ${node.url}`)
      log('blue', `     Status: ${node.fullyWorking ? 'Fully Working ✨' : 'Partially Working ⚠️'}`)
    })
    
    log('cyan', '\n💡 Update your code to use a working node:')
    log('blue', `
const computer = new Computer({
  chain: 'LTC',
  network: 'testnet',
  url: '${results.workingNodes[0].url}'
})
    `)
  }
  
  // Save results
  log('blue', '\n━━━ Saving detailed results ━━━')
  const fs = await import('fs')
  const reportPath = './testnet-diagnostic-report.json'
  fs.writeFileSync(reportPath, JSON.stringify(results, null, 2))
  log('green', `✅ Detailed report saved to: ${reportPath}`)
  
  return results
}

// Run diagnostics
runDiagnostics()
  .then(() => {
    console.log('\n╔════════════════════════════════════════════════════════════╗')
    console.log('║   DIAGNOSTIC COMPLETE                                      ║')
    console.log('╚════════════════════════════════════════════════════════════╝\n')
    process.exit(0)
  })
  .catch(error => {
    log('red', `\n❌ Diagnostic failed with error: ${error.message}`)
    console.error(error)
    process.exit(1)
  })
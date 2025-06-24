const { execSync } = require('child_process');

console.log('=== Checking Virtual Display Setup ===');

// Check if Xvfb is running
try {
  const xvfbProcess = execSync('ps aux | grep Xvfb').toString();
  console.log('Xvfb processes found:');
  console.log(xvfbProcess);
} catch (error) {
  console.error('Failed to check Xvfb process:', error.message);
}

// Check DISPLAY environment variable
console.log(`\nDISPLAY environment variable: ${process.env.DISPLAY}`);

// Check X11 socket
try {
  const x11Socket = execSync('ls -la /tmp/.X11-unix/').toString();
  console.log('\nX11 sockets:');
  console.log(x11Socket);
} catch (error) {
  console.error('Failed to check X11 socket:', error.message);
}

// Check if chrome can connect to the display
const puppeteer = require('puppeteer');

async function testPuppeteer() {
  console.log('\nTesting Puppeteer with display...');
  try {
    const browser = await puppeteer.launch({ 
      headless: false,
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
      ]
    });
    
    console.log('✅ Puppeteer browser launched successfully!');
    
    const page = await browser.newPage();
    await page.goto('https://www.example.com');
    
    console.log('✅ Page navigated successfully!');
    
    const title = await page.title();
    console.log(`Page title: ${title}`);
    
    await browser.close();
    console.log('✅ Browser closed successfully!');
    
    return true;
  } catch (error) {
    console.error('❌ Error testing Puppeteer:', error.message);
    return false;
  }
}

testPuppeteer()
  .then(success => {
    console.log(`\nPuppeteer test ${success ? 'PASSED' : 'FAILED'}`);
    console.log('=== End of Display Check ===');
  })
  .catch(err => {
    console.error('Error during test:', err);
  });

// stealth.js - Implements various techniques to avoid bot detection
const UserAgent = require('user-agents');

async function applyStealthMode(page) {
  console.log("Applying stealth mode to page...");
  
  try {
    // 1. Use a realistic user agent
    const userAgent = new UserAgent({ deviceCategory: 'desktop' }).toString();
    await page.setUserAgent(userAgent);
    
    // 2. Set WebDriver property to undefined (anti-detection)
    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, 'webdriver', {
        get: () => undefined,
      });
    });
    
    // 3. Hide automation features
    await page.evaluateOnNewDocument(() => {
      // Hide Chrome's automation features
      window.chrome = {
        runtime: {},
      };
      
      // Pass navigator.languages test
      Object.defineProperty(navigator, 'languages', {
        get: () => ['en-US', 'en'],
      });
      
      // Pass plugins length test
      Object.defineProperty(navigator, 'plugins', {
        get: () => {
          // This just needs to have length > 0
          return [1, 2, 3, 4, 5];
        },
      });
    });
    
    // 4. Pass the permissions test
    await page.evaluateOnNewDocument(() => {
      const originalQuery = window.navigator.permissions.query;
      window.navigator.permissions.query = (parameters) => (
        parameters.name === 'notifications' ?
          Promise.resolve({ state: Notification.permission }) :
          originalQuery(parameters)
      );
    });
    
    // 5. Add missing ScrollBar
    await page.evaluateOnNewDocument(() => {
      // Overwrite the `plugins` property to use a custom getter.
      Object.defineProperty(navigator, 'plugins', {
        // This just needs to have `length > 0` for the current test,
        // but we could mock the plugins too if necessary.
        get: () => [1, 2, 3, 4, 5],
      });
    });
    
    // 6. Add custom browser behaviors for known bot detection scripts
    await page.evaluateOnNewDocument(() => {
      // Add some window properties that are usually set by Chrome
      window.innerWidth = 1920;
      window.innerHeight = 1080;
      window.outerWidth = 1920;
      window.outerHeight = 1080;
      window.screenX = 0;
      window.screenY = 0;
      
      // Random fingerprints to throw off detection
      Object.defineProperty(HTMLCanvasElement.prototype, 'toDataURL', {
        value: function() {
          // Return a slightly randomized canvas value each time
          const originalToDataURL = HTMLCanvasElement.prototype.toDataURL.bind(this);
          const dataUrl = originalToDataURL.apply(this, arguments);
          return dataUrl.length < 10 ? dataUrl : dataUrl.replace(/.$/, Math.floor(Math.random() * 10));
        }
      });
    });
    
    console.log("Stealth mode applied successfully");
    return true;
  } catch (error) {
    console.error("Failed to apply stealth mode:", error);
    return false;
  }
}

module.exports = { applyStealthMode };

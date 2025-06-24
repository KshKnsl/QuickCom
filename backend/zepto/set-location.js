async function setZeptoLocation(page, location) {
  console.log(`Setting Zepto location to: ${location}`);
  try {
    if (!page.url().includes("zeptonow.com")) {
      await page.goto("https://www.zeptonow.com/");
    }

    // Handle initial location setup or change location
    try {
      // Check if location button exists
      const locationBtnSelector = '[data-testid="location-btn"], .location-btn, [class*="location-button"]';
      const hasLocationBtn = await page.$(locationBtnSelector);
      
      if (hasLocationBtn) {
        await page.click(locationBtnSelector);
        console.log("Clicked location button");
      }
      
      // Enter location in search input
      await page.waitForSelector('input[type="text"][placeholder*="location"], input[type="text"][placeholder*="address"]', { timeout: 5000 });
      await page.type('input[type="text"][placeholder*="location"], input[type="text"][placeholder*="address"]', location);
      
      await new Promise((resolve) => setTimeout(resolve, 1000));
      
      // Wait for and click the first suggestion
      await page.waitForSelector('[class*="suggestion-item"]:first-child, [class*="location-item"]:first-child', { timeout: 5000 });
      await page.click('[class*="suggestion-item"]:first-child, [class*="location-item"]:first-child');
      
      await new Promise((resolve) => setTimeout(resolve, 2000));
    } catch (error) {
      console.error(`Error during Zepto location selection: ${error.message}`);
      // Try alternative approach if available
    }
    
    // Verify location was set
    const locationTitle = await isLocationSet(page);
    if (locationTitle) {
      console.log(`Zepto location successfully set to: ${locationTitle}`);
      return locationTitle;
    } else {
      console.log(`Failed to verify Zepto location after setting to: ${location}`);
      return null;
    }
  } catch (error) {
    console.error("Error setting Zepto location:", error);
    return null;
  }
}

async function isLocationSet(page) {
  console.log("Checking if Zepto location is set...");
  
  // Various possible selectors where Zepto might display the current location
  const locationSelectors = [
    '[data-testid="location-btn"]',
    '[class*="location-display"]',
    '[class*="address-display"]',
    '[class*="location-bar"]',
    'button:has([class*="location-icon"])',
    '[class*="header"] [class*="location"]'
  ];

  try {
    // Try each selector
    for (const selector of locationSelectors) {
      try {
        const exists = await page.$(selector);
        if (!exists) continue;
        
        const titleText = await page.$eval(selector, (el) => el.textContent.trim());
        if (titleText && titleText.length > 2 && !titleText.toLowerCase().includes("select") && !titleText.toLowerCase().includes("enter")) {
          console.log(`Zepto location found: "${titleText}"`);
          return titleText;
        }
      } catch (selectorError) {
        // Try next selector
      }
    }
    
    // Check if we're on the main page (success indicator)
    const isOnMainPage = await page.evaluate(() => {
      return window.location.pathname === '/' || 
             document.querySelector('[class*="product-list"], [class*="category-list"]') !== null;
    });
    
    if (isOnMainPage) {
      console.log("On Zepto main page, assuming location is set");
      return "Location Set";
    }
  } catch (error) {
    console.log(
      "Location ETA container not found within 5 seconds or error during check."
    );
    return "400";
  }
}

async function setZeptoLocation(page, location) {
  console.log(`Setting Zepto location to: ${location}`);
  try {
    if (!page.url().includes("zeptonow.com")) {
      await page.goto("https://www.zeptonow.com/");
    }

    // Check if we need to set location or if we're already on the main page
    const hasLocationInput = await page.evaluate(() => {
      return !!document.querySelector('.location-input') || 
             !!document.querySelector('[placeholder*="location"]') ||
             !!document.querySelector('[placeholder*="address"]');
    });

    if (hasLocationInput) {
      // Find and click the location input field
      await page.waitForSelector('.location-input, [placeholder*="location"], [placeholder*="address"]', { timeout: 5000 });
      await page.click('.location-input, [placeholder*="location"], [placeholder*="address"]');
      
      // Type the location
      await page.waitForSelector('input[type="text"]', { timeout: 5000 });
      await page.type('input[type="text"]', location);
      
      // Wait for location suggestions to appear and click the first one
      await page.waitForSelector('.location-suggestions .suggestion-item, .address-suggestions li', { timeout: 5000 });
      await new Promise(resolve => setTimeout(resolve, 1000)); // Wait for all suggestions to load
      await page.click('.location-suggestions .suggestion-item:first-child, .address-suggestions li:first-child');
      
      // Wait for the page to update with the new location
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    // Verify that location is set
    const locationTitle = await isLocationSet(page);
    if (locationTitle) {
      console.log(`Zepto location successfully set to: ${locationTitle}`);
      return locationTitle;
    } else {
      console.log('Failed to verify Zepto location');
      return null;
    }
  } catch (error) {
    console.error("Error setting Zepto location:", error);
    return null;
  }
}

async function isLocationSet(page) {
  try {
    // Try different selectors to find the location display element
    const locationText = await page.evaluate(() => {
      const locationEl = 
        document.querySelector('.location-display') ||
        document.querySelector('.delivery-location') ||
        document.querySelector('.selected-location') ||
        document.querySelector('[data-testid="selected-location"]');
      
      return locationEl ? locationEl.innerText.trim() : null;
    });
    
    return locationText;
  } catch (error) {
    console.error("Error checking if Zepto location is set:", error);
    return null;
  }
}

module.exports = {
  setZeptoLocation,
  isLocationSet
};

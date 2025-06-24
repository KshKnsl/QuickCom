async function setInstamartLocation(page, loc) {
  console.log(`Setting Instamart location to: ${loc}`);
  
  try {
    // Navigate to Instamart if not already there
    if (!page.url().includes("swiggy.com/instamart")) {
      console.log("Navigating to Instamart...");
      await page.goto("https://www.swiggy.com/instamart", {
        waitUntil: "domcontentloaded",
        timeout: 30000
      });
    }
    
    // Set viewport for consistent rendering
    await page.setViewport({ width: 1536, height: 695 });
    
    // Click on the address/location button
    console.log("Clicking on location button...");
    await page.waitForSelector('[data-testid="address-name"]', { timeout: 10000 })
      .catch(e => console.log("Address name selector not found, trying to proceed anyway..."));
    
    await page.click('[data-testid="address-name"]')
      .catch(e => console.log("Click on address name failed, retrying..."));
    
    // Click on search location field
    console.log("Opening location search...");
    await page.waitForSelector('[data-testid="search-location"]', { timeout: 10000 });
    try {
      await Promise.all([
        page.click('[data-testid="search-location"]'),
        page.waitForNavigation({ timeout: 10000 }).catch(() => {})
      ]);
    } catch (err) {
      console.log("Navigation after clicking search location may not have occurred:", err.message);
    }
    
    // Wait for and click on the location search input field
    console.log("Focusing location search input...");
    await page.waitForSelector('[placeholder="Search for area, street name\\2026"]', { timeout: 10000 });
    await page.click('[placeholder="Search for area, street name\\2026"]');
    
    // Type the location
    console.log(`Typing location search: ${loc}`);
    await page.waitForSelector('[placeholder="Search for area, street name\\2026"]:not([disabled])', { timeout: 10000 });
    await page.type('[placeholder="Search for area, street name\\2026"]', loc);
    
    // Wait for location suggestions and click the first one
    console.log("Waiting for location suggestions...");
    await new Promise(r => setTimeout(r, 2000));
    await page.waitForSelector('._11n32:nth-child(1)', { timeout: 10000 })
      .catch(e => console.log("Location suggestion selector not found, trying alternative..."));
    
    // Click on the first suggestion
    console.log("Selecting first location suggestion...");
    await page.click('._11n32:nth-child(1)')
      .catch(async e => {
        console.log("Failed to click first suggestion, trying alternative selector...");
        await page.$$eval('._11n32', elements => {
          if (elements.length > 0) elements[0].click();
        }).catch(e => console.log("Alternative selection also failed"));
      });
    
    // Click on confirm location button
    console.log("Confirming location...");
    await page.waitForSelector('._2xPHa', { timeout: 10000 });
    await page.click('._2xPHa');
    
    // Wait for location to be set
    await new Promise(r => setTimeout(r, 3000));
    
    // Verify location was set
    const locTitle = await isLocationSet(page);
    if (locTitle) {
      console.log(`Instamart location successfully set to: ${locTitle}`);
      return locTitle;
    } else {
      console.log(`Failed to verify Instamart location after setting to: ${loc}`);
      return null;
    }
  } catch (err) {
    console.error("Error setting Instamart location:", err);
    return null;
  }
}

async function isLocationSet(page) {
  console.log("Checking if Instamart location is set...");
  
  try {
    // Try different selectors that might contain location information
    const selectors = [
      '[data-testid="address-name"]',
      '._3FN4I',
      '._3eFQ-',
      '.location-address',
      '.address-text'
    ];

    for (const sel of selectors) {
      try {
        const el = await page.$(sel);
        if (!el) continue;
        
        const txt = await page.$eval(sel, el => el.textContent.trim());
        if (txt && txt.length > 2 && !txt.toLowerCase().includes("other") && 
            !txt.toLowerCase().includes("select") && !txt.toLowerCase().includes("enter")) {
          console.log(`Instamart location found: "${txt}"`);
          return txt;
        }
      } catch (e) {
        // Continue to next selector if this one fails
      }
    }
    
    // Check if we're on the main page with products
    const isMain = await page.evaluate(() => {
      return document.querySelector('.product-grid, [class*="product-list"], [class*="items-container"]') !== null;
    });
    
    if (isMain) {
      console.log("On Instamart main page with products, assuming location is set");
      return "Location Set";
    }
    
    return null;
  } catch (err) {
    console.error("Error checking if Instamart location is set:", err);
    return null;
  }
}

// Custom function to handle delivery time
async function getDeliveryTime(page) {
  try {
    // Try to find delivery time information
    const deliveryTimeSelectors = [
      '.delivery-time',
      '.eta-text',
      '[data-testid="delivery-time"]',
      '[class*="delivery-time"]',
      '[class*="eta"]'
    ];
    
    for (const sel of deliveryTimeSelectors) {
      try {
        const el = await page.$(sel);
        if (!el) continue;
        
        const deliveryTime = await page.$eval(sel, el => el.textContent.trim());
        if (deliveryTime) {
          // If delivery time is "earliest", return 10 mins as specified
          if (deliveryTime.toLowerCase().includes("earliest")) {
            console.log("Delivery time is 'earliest', returning 10 mins");
            return "10 mins";
          }
          console.log(`Found delivery time: ${deliveryTime}`);
          return deliveryTime;
        }
      } catch (e) {
        // Continue to next selector
      }
    }
    
    console.log("Delivery time not found, defaulting to 10 mins");
    return "10 mins"; // Default value if not found
  } catch (err) {
    console.error("Error getting delivery time:", err);
    return "10 mins"; // Default fallback
  }
}

module.exports = {
  setInstamartLocation,
  isLocationSet,
  getDeliveryTime
};

async function setZeptoLocation(page, location) {
  console.log(`Setting Zepto location to: ${location}`);
  try {
    // Go to the Zepto website
    if (!page.url().includes("zeptonow.com")) {
      await page.goto("https://www.zeptonow.com/");
    }

    // Handle initial location setup or change location
    try {
      // Click on "Select Location" button
      await page.waitForSelector('.max-w-\\[170px\\] > span', { timeout: 5000 });
      await page.click('.max-w-\\[170px\\] > span');
      console.log("Clicked location button");
      
      // Wait for the search address input field and click on it
      await page.waitForSelector('[placeholder="Search a new address"]', { timeout: 5000 });
      await page.click('[placeholder="Search a new address"]');
      
      // Type the location in search input
      await page.waitForSelector('[placeholder="Search a new address"]:not([disabled])', { timeout: 5000 });
      await page.type('[placeholder="Search a new address"]', location);
      console.log(`Typed location: ${location}`);
      
      // Wait for the location suggestion to appear and click on it
      await page.waitForSelector('.flex:nth-child(1) > .ml-4 > div > .font-heading', { timeout: 5000 });
      await page.click('.flex:nth-child(1) > .ml-4 > div > .font-heading');
      console.log("Selected location from suggestions");
      
      // Wait for confirm button and click "Confirm & Continue" 
      await page.waitForSelector('.bg-skin-primary > .flex', { timeout: 5000 });
      await page.click('.bg-skin-primary > .flex');
      console.log("Clicked confirm and continue");
      
      // Wait for page to update with the new location
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
  
  try {
    // Check for the location display in the header
    // Based on the current Zepto website structure
    const locationSelectors = [
      // Current main selector for the location display
      '.max-w-\\[170px\\] > span',
      // Alternative selectors if the UI changes
      '[data-testid="location-btn"]',
      '[class*="location-display"]',
      '[class*="address-display"]',
      '.selected-location',
      '.delivery-location'
    ];

    // Try each selector to find the location display element
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
             document.querySelector('.product-grid, [class*="product-list"], [class*="category-list"]') !== null;
    });
    
    if (isOnMainPage) {
      console.log("On Zepto main page, assuming location is set");
      return "Location Set";
    }
    
    return null;
  } catch (error) {
    console.error("Error checking if Zepto location is set:", error);
    return null;
  }
}



module.exports = {
  setZeptoLocation,
  isLocationSet
};

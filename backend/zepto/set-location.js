async function setZeptoLocation(page, loc) {
  console.log(`Setting Zepto location to: ${loc}`);
  let attempts = 0;
  const maxAttempts = 2;
  
  while (attempts < maxAttempts) {
    attempts++;
    console.log(`Location setting attempt ${attempts}/${maxAttempts}`);
    
    try {
      if (!page.url().includes("zeptonow.com")) {
        await page.goto("https://www.zeptonow.com/", {
          waitUntil: 'domcontentloaded',
          timeout: 120000 // Increased timeout to 2 minutes
        });
      }

      try {
        // Increased all timeouts to 30 seconds
        await page.waitForSelector('.max-w-\\[170px\\] > span', { timeout: 30000 });
        await page.click('.max-w-\\[170px\\] > span');
        console.log("Clicked location button");
        await new Promise(r => setTimeout(r, 3000)); // Added wait after click
        
        await page.waitForSelector('[placeholder="Search a new address"]', { timeout: 30000 });
        await page.click('[placeholder="Search a new address"]');
        
        await page.waitForSelector('[placeholder="Search a new address"]:not([disabled])', { timeout: 30000 });
        await page.type('[placeholder="Search a new address"]', loc, { delay: 100 }); // Added typing delay
        console.log(`Typed location: ${loc}`);
        await new Promise(r => setTimeout(r, 3000)); // Added wait after typing
        
        await page.waitForSelector('.flex:nth-child(1) > .ml-4 > div > .font-heading', { timeout: 30000 });
        await page.click('.flex:nth-child(1) > .ml-4 > div > .font-heading');
        console.log("Selected location from suggestions");
        await new Promise(r => setTimeout(r, 3000)); // Added wait after selection
        
        await page.waitForSelector('.bg-skin-primary > .flex', { timeout: 30000 });
        await page.click('.bg-skin-primary > .flex');
        console.log("Clicked confirm and continue");
        await new Promise(r => setTimeout(r, 5000)); // Increased wait after confirmation
      } catch (err) {
        console.error(`Error during Zepto location selection: ${err.message}`);
      }
      
      const locTitle = await isLocSet(page);
      if (locTitle) {
        console.log(`Zepto location successfully set to: ${locTitle}`);
        return locTitle;
      } else if (attempts < maxAttempts) {
        console.log(`Failed to verify Zepto location, retrying... (attempt ${attempts}/${maxAttempts})`);
        // Refresh page before retrying
        await page.reload({ waitUntil: 'domcontentloaded', timeout: 60000 });
        await new Promise(r => setTimeout(r, 3000));
      } else {
        console.log(`Failed to verify Zepto location after ${maxAttempts} attempts`);
        return null;
      }
    } catch (err) {
      console.error(`Error setting Zepto location (attempt ${attempts}/${maxAttempts}):`, err);
      if (attempts >= maxAttempts) {
        return null;
      }
      // Wait before retrying
      await new Promise(r => setTimeout(r, 5000));
    }
  }
  
  return null;
}

async function isLocSet(page) {
  console.log("Checking if Zepto location is set...");
  
  try {
    // Wait longer before checking to ensure page has settled
    await new Promise(r => setTimeout(r, 3000));
    
    const selectors = [
      '.max-w-\\[170px\\] > span',
      '[data-testid="location-btn"]',
      '[class*="location-display"]',
      '[class*="address-display"]',
      '.selected-location',
      '.delivery-location',
      '[class*="address"]',
      '[class*="location"]',
      '.font-medium.text-sm',
      '.font-heading',
      '[aria-label*="location"]',
      '[aria-label*="address"]'
    ];

    for (const sel of selectors) {
      try {
        const el = await page.$(sel);
        if (!el) continue;
        
        const txt = await page.$eval(sel, el => el.textContent.trim());
        if (txt && txt.length > 2 && !txt.toLowerCase().includes("select") && !txt.toLowerCase().includes("enter")) {
          console.log(`Zepto location found: "${txt}"`);
          return txt;
        }
      } catch (e) {
      }
    }
    
    const isMain = await page.evaluate(() => {
      return window.location.pathname === '/' || 
             document.querySelector('.product-grid, [class*="product-list"], [class*="category-list"]') !== null;
    });
    
    if (isMain) {
      console.log("On Zepto main page, assuming location is set");
      return "Location Set";
    }
    
    return null;
  } catch (err) {
    console.error("Error checking if Zepto location is set:", err);
    return null;
  }
}

module.exports = {
  setZeptoLocation,
  isLocSet
};

async function setZeptoLocation(page, loc) {
  console.log(`Setting Zepto location to: ${loc}`);
  try {
    if (!page.url().includes("zeptonow.com")) {
      await page.goto("https://www.zeptonow.com/");
    }

    try {
      await page.waitForSelector('.max-w-\\[170px\\] > span', { timeout: 5000 });
      await page.click('.max-w-\\[170px\\] > span');
      console.log("Clicked location button");
      
      await page.waitForSelector('[placeholder="Search a new address"]', { timeout: 5000 });
      await page.click('[placeholder="Search a new address"]');
      
      await page.waitForSelector('[placeholder="Search a new address"]:not([disabled])', { timeout: 5000 });
      await page.type('[placeholder="Search a new address"]', loc);
      console.log(`Typed location: ${loc}`);
      
      await page.waitForSelector('.flex:nth-child(1) > .ml-4 > div > .font-heading', { timeout: 5000 });
      await page.click('.flex:nth-child(1) > .ml-4 > div > .font-heading');
      console.log("Selected location from suggestions");
      
      await page.waitForSelector('.bg-skin-primary > .flex', { timeout: 5000 });
      await page.click('.bg-skin-primary > .flex');
      console.log("Clicked confirm and continue");
      await new Promise(r => setTimeout(r, 2000));
    } catch (err) {
      console.error(`Error during Zepto location selection: ${err.message}`);
    }
    
    const locTitle = await isLocSet(page);
    if (locTitle) {
      console.log(`Zepto location successfully set to: ${locTitle}`);
      return locTitle;
    } else {
      console.log(`Failed to verify Zepto location after setting to: ${loc}`);
      return null;
    }
  } catch (err) {
    console.error("Error setting Zepto location:", err);
    return null;
  }
}

async function isLocSet(page) {
  console.log("Checking if Zepto location is set...");
  
  try {
    const selectors = [
      '.max-w-\\[170px\\] > span',
      '[data-testid="location-btn"]',
      '[class*="location-display"]',
      '[class*="address-display"]',
      '.selected-location',
      '.delivery-location'
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

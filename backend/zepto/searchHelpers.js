async function navigateToSearch(page, term) {
  console.log(`Navigating to Zepto search with term: ${term}`);
  
  try {
    const encTerm = encodeURIComponent(term);
    
    console.log(`Going to: https://www.zeptonow.com/search?query=${encTerm}`);
    await page.goto(`https://www.zeptonow.com/search?query=${encTerm}`, {
      waitUntil: 'networkidle2', 
      timeout: 30000
    });
    
    const hasProds = await page.evaluate(() => {
      return document.querySelectorAll('[data-testid="product-card"]').length > 0;
    });
    
    if (!hasProds) {
      console.log(`No products found, trying alternate URL format: https://www.zeptonow.com/srp?q=${encTerm}`);
      await page.goto(`https://www.zeptonow.com/srp?q=${encTerm}`, {
        waitUntil: 'networkidle2',
        timeout: 30000
      });
    }
    
    const url = await page.url();
    console.log(`Current page URL: ${url}`);
    
    await new Promise(r => setTimeout(r, 2000));
    
    return true;
  } catch (err) {
    console.log(`Error navigating to Zepto search URL: ${err.message}`);
    return false;
  }
}

async function hasProductCards(page) {
  try {
    const prodCount = await page.evaluate(() => {
      return document.querySelectorAll('[data-testid="product-card"]').length;
    });
    return prodCount > 0;
  } catch (err) {
    console.log(`Error checking for product cards: ${err.message}`);
    return false;
  }
}

async function ensureContentLoaded(page) {
  try {
    console.log("Ensuring Zepto content is loaded...");
    
    try {
      const loadSel = '.loading-container, .loading, .spinner, [class*="loading"], [class*="skeleton"]';
      const hasLoader = await page.$(loadSel);
      
      if (hasLoader) {
        console.log("Found loading indicators, waiting for them to disappear");
        await page.waitForSelector(loadSel, { hidden: true, timeout: 10000 })
          .catch(e => console.log(`Loading indicators still present after timeout: ${e.message}`));
        await new Promise(r => setTimeout(r, 1000));
      }
      
      console.log("Waiting for product cards to appear");
      await page.waitForSelector('[data-testid="product-card"]', { 
        timeout: 10000,
        visible: true
      }).catch(e => console.log(`Product cards not found within timeout: ${e.message}`));
      
      const prodCount = await page.evaluate(() => {
        return document.querySelectorAll('[data-testid="product-card"]').length;
      });
      
      console.log(`Found ${prodCount} product cards on the page`);
      
      if (prodCount > 0) {
        await new Promise(r => setTimeout(r, 1500));
        return true;
      }
      
      const noResults = await page.evaluate(() => {
        const txt = document.body.innerText;
        return txt.includes("No results found") || 
               txt.includes("No products found") || 
               txt.includes("Try another search");
      });
      
      if (noResults) {
        console.log("No results found message detected on page");
        return false;
      }
      
      const hasGrid = await page.evaluate(() => {
        return !!document.querySelector('.grid') && 
               document.querySelectorAll('a[href*="/pn/"]').length > 0;
      });
      
      console.log(`Product grid detected: ${hasGrid}`);
      
      if (hasGrid) {
        await new Promise(r => setTimeout(r, 1500));
        return true;
      }
      
      return false;
    } catch (err) {
      console.log(`Timeout waiting for content to load: ${err.message}`);
      
      const anyProds = await page.evaluate(() => {
        return document.querySelectorAll('[data-testid="product-card"]').length > 0;
      });
      
      return anyProds;
    }
  } catch (err) {
    console.log(`Error ensuring content loaded: ${err.message}`);
    return false;
  }
}

function extractProductInformation(prodJson) {
  try {
    console.log("Extracting Zepto product information...");

    if (prodJson && prodJson.response && prodJson.response.snippets) {
      console.log("Extracting from JSON response...");
      const products = [];
      const prodSnips = prodJson.response.snippets.filter(s => 
        s.data && 
        s.data.identity && 
        s.data.identity.id !== "product_container" && 
        s.data.name
      );

      for (const snip of prodSnips) {
        try {
          const data = snip.data;
          
          const product = {
            id: data.identity.id || `zepto_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`,
            name: data.name || "Unknown Product",
            price: data.final_price ? `₹${data.final_price}` : "Price unavailable",
            originalPrice: data.price ? `₹${data.price}` : null,
            savings: data.price && data.final_price ? 
              `₹${(parseFloat(data.price) - parseFloat(data.final_price)).toFixed(2)}` : null,
            quantity: data.weight || data.quantity || "1 item",
            deliveryTime: data.delivery_time || "10 mins",
            discount: data.discount_text || (
              data.price && data.final_price ? 
              `${Math.round(((parseFloat(data.price) - parseFloat(data.final_price)) / parseFloat(data.price)) * 100)}% OFF` : null
            ),
            imageUrl: data.image_url || data.img_url || "",
            available: !data.out_of_stock,
            source: "zepto"
          };

          products.push(product);
        } catch (err) {
          console.error(`Error processing individual Zepto product:`, err);
        }
      }

      console.log(`Extracted ${products.length} products from JSON response`);
      if (products.length > 0) {
        return products;
      }
    }

    return extractProductsFromHTML(prodJson.page);
  } catch (err) {
    console.error("Error extracting Zepto product information:", err);
    if (prodJson && prodJson.page) {
      console.log("Falling back to HTML extraction...");
      return extractProductsFromHTML(prodJson.page);
    }
    return [];
  }
}

async function extractProductsFromHTML(page) {
  try {
    console.log("Extracting Zepto products from HTML structure...");
    
    const products = await page.evaluate(() => {
      const cards = Array.from(document.querySelectorAll('[data-testid="product-card"]'));
      console.log(`Found ${cards.length} product cards on the page`);
      
      return cards.map(card => {
        try {
          const prodUrl = card.getAttribute('href');
          const id = prodUrl ? 
            prodUrl.split('/').pop() || `zepto_html_${Date.now()}_${Math.random().toString(36).substring(2, 8)}` : 
            `zepto_html_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
            
          const nameEl = card.querySelector('[data-testid="product-card-name"]');
          const name = nameEl ? nameEl.textContent.trim() : "Unknown Product";
          
          const priceEl = card.querySelector('.text-\\[20px\\].font-\\[700\\]');
          const price = priceEl ? priceEl.textContent.trim() : "Price unavailable";
          
          const origPriceEl = card.querySelector('.text-lg.font-\\[450\\].line-through');
          const origPrice = origPriceEl ? origPriceEl.textContent.trim() : null;
          
          const discEl = card.querySelector('.bg-\\[\\#E5FAEC\\]');
          const discount = discEl ? discEl.textContent.trim() : null;
          
          const weightEl = card.querySelector('.text-base.font-\\[450\\].text-\\[\\#5A6477\\]');
          const qty = weightEl ? weightEl.textContent.trim() : "1 item";
          
          const deliveryEl = card.querySelector('.block.font-body.py-0\\.5.text-base.font-\\[450\\].text-\\[\\#586274\\]');
          const delivery = deliveryEl ? deliveryEl.textContent.trim() : "10 mins";
          
          const imgEl = card.querySelector('[data-testid="product-card-image"]');
          const img = imgEl ? imgEl.getAttribute('src') : "";
          
          const notifyBtn = card.querySelector('button[aria-label="Notify"]');
          const available = !notifyBtn;
          
          const ratingEl = card.querySelector('.block.font-body.text-base.font-\\[500\\].text-\\[\\#329537\\]');
          const rating = ratingEl ? ratingEl.textContent.trim() : null;
          
          let savings = null;
          if (price && origPrice) {
            const priceVal = parseFloat(price.replace('₹', '').trim());
            const origVal = parseFloat(origPrice.replace('₹', '').trim());
            if (!isNaN(priceVal) && !isNaN(origVal)) {
              savings = `₹${(origVal - priceVal).toFixed(2)}`;
            }
          }
          
          return {
            id,
            name,
            price,
            originalPrice: origPrice,
            savings,
            quantity: qty,
            deliveryTime: delivery,
            discount,
            rating,
            imageUrl: img,
            available,
            source: "zepto"
          };
        } catch (err) {
          console.error("Error extracting product data:", err);
          return null;
        }
      }).filter(p => p !== null);
    });
    
    console.log(`Extracted ${products.length} products from HTML structure`);
    return products;
  } catch (err) {
    console.error("Error extracting products from HTML:", err);
    return [];
  }
}

module.exports = {
  navigateToSearch,
  ensureContentLoaded,
  extractProductInformation
};

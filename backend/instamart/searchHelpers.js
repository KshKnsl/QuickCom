async function navigateToSearch(page, searchTerm) {
  console.log(`Directly navigating to Instamart search URL with term: ${searchTerm}`);
  
  try {
    const encodedSearchTerm = encodeURIComponent(searchTerm);
    
    // Using the direct Instamart search URL as provided
    console.log(`Going to: https://www.swiggy.com/instamart/search?custom_back=true&query=${encodedSearchTerm}`);
    const response = await page.goto(`https://www.swiggy.com/instamart/search?custom_back=true&query=${encodedSearchTerm}`, {
      waitUntil: 'networkidle2', 
      timeout: 50000
    });
    
    const url = await page.url();
    console.log(`Current page URL: ${url}`);
    
    // If we ended up on a general search page instead of Instamart-specific search
    if (!url.includes('instamart/search')) {
      try {
        const instamartTabSelector = 'button[data-testid="instamart-tab"], a[href*="instamart"]';
        const hasInstamartTab = await page.$(instamartTabSelector);
        
        if (hasInstamartTab) {
          await page.click(instamartTabSelector);
          console.log('Clicked Instamart tab');
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      } catch (error) {
        console.log(`Error clicking Instamart tab: ${error.message}`);
      }
    }
    
    // Make sure we've actually landed on an Instamart page
    const currentUrl = await page.url();
    if (!currentUrl.includes('instamart')) {
      console.log(`Not on Instamart page, trying direct navigation`);
      await page.goto(`https://www.swiggy.com/instamart/search?custom_back=true&query=${encodedSearchTerm}`, {
        waitUntil: 'networkidle2',
        timeout: 300000
      });
    }
    
    return true;
  } catch (error) {
    console.log(`Error navigating to Instamart search URL: ${error.message}`);
    return false;
  }
}

async function ensureContentLoaded(page) {
  try {
    console.log("Ensuring Instamart content is loaded...");
    
    try {
      // Check for loading indicators and wait for them to disappear
      const loadingSelector = '.loading, .shimmer, .skeleton, [class*="loading"], [class*="Loader"]';
      const hasLoadingIndicator = await page.$(loadingSelector);
      
      if (hasLoadingIndicator) {
        console.log("Found loading indicators, waiting for them to disappear");
        await page.waitForSelector(loadingSelector, { hidden: true, timeout: 10000 })
          .catch(e => console.log(`Loading indicators still present after timeout: ${e.message}`));
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      
      // Wait for product containers based on the HTML structure provided
      console.log("Waiting for product cards to appear");
      const productSelector = '[data-testid="default_container_ux4"], .XjYJe._2_few, ._179Mx';
      await page.waitForSelector(productSelector, { 
        timeout: 10000,
        visible: true
      }).catch(e => console.log(`Product cards not found within timeout: ${e.message}`));
      
      // Check if we successfully loaded product cards
      const productCardCount = await page.evaluate(() => {
        return document.querySelectorAll('[data-testid="default_container_ux4"], .XjYJe._2_few').length;
      });
      
      console.log(`Found ${productCardCount} product cards on the page`);
      
      if (productCardCount > 0) {
        // Give the page a moment to fully render all product details
        await new Promise(resolve => setTimeout(resolve, 1500));
        return true;
      }
      
      // Check for no results message
      const noResultsFound = await page.evaluate(() => {
        const pageText = document.body.innerText;
        return pageText.includes("No results found") || 
               pageText.includes("No matching products") || 
               pageText.includes("Try another search");
      });
      
      if (noResultsFound) {
        console.log("No results found message detected on page");
        return false;
      }
      
      return false;
    } catch (error) {
      console.log(`Timeout waiting for content to load: ${error.message}`);
      
      // Even if we time out, check if there are any product cards
      const anyProductCards = await page.evaluate(() => {
        return document.querySelectorAll('[data-testid="default_container_ux4"], .XjYJe._2_few').length > 0;
      });
      
      return anyProductCards;
    }
  } catch (error) {
    console.log(`Error ensuring content loaded: ${error.message}`);
    return false;
  }
}

function extractProductInformation(productJsonResponse) {
  try {
    console.log("Extracting Instamart product information...");
    
    // First try to extract from JSON response if available
    if (productJsonResponse && productJsonResponse.response && productJsonResponse.response.snippets) {
      console.log("Extracting from JSON response...");
      const products = [];
      const productSnippets = productJsonResponse.response.snippets.filter(snippet => 
        snippet.data && 
        snippet.data.identity && 
        snippet.data.identity.id !== "product_container" && 
        snippet.data.name
      );

      for (const snippet of productSnippets) {
        try {
          const productData = snippet.data;
          
          // Extract product information
          const product = {
            id: productData.identity.id || `instamart_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`,
            name: productData.name || "Unknown Product",
            price: productData.final_price ? `₹${productData.final_price}` : "Price unavailable",
            originalPrice: productData.price ? `₹${productData.price}` : null,
            savings: productData.price && productData.final_price ? 
              `₹${(parseFloat(productData.price) - parseFloat(productData.final_price)).toFixed(2)}` : null,
            quantity: productData.weight || productData.quantity || "1 item",
            deliveryTime: productData.delivery_time || "15-30 mins",
            discount: productData.discount_text || (
              productData.price && productData.final_price ? 
              `${Math.round(((parseFloat(productData.price) - parseFloat(productData.final_price)) / parseFloat(productData.price)) * 100)}% OFF` : null
            ),
            imageUrl: productData.image_url || productData.img_url || "",
            available: !productData.out_of_stock,
            source: "instamart"
          };

          products.push(product);
        } catch (error) {
          console.error(`Error processing individual Instamart product:`, error);
          // Continue to next product
        }
      }

      console.log(`Extracted ${products.length} Instamart products from JSON response`);
      if (products.length > 0) {
        return products;
      }
    }

    // Fallback to HTML extraction if JSON extraction failed or returned no products
    return extractProductsFromHTML(productJsonResponse.page);
  } catch (error) {
    console.error("Error extracting Instamart product information:", error);
    if (productJsonResponse && productJsonResponse.page) {
      console.log("Falling back to HTML extraction...");
      return extractProductsFromHTML(productJsonResponse.page);
    }
    return [];
  }
}

// Helper function to extract products from HTML structure
async function extractProductsFromHTML(page) {
  try {
    console.log("Extracting Instamart products from HTML structure...");
    
    // Extract products from the current page HTML based on the provided structure
    const products = await page.evaluate(() => {
      const productCards = Array.from(document.querySelectorAll('[data-testid="default_container_ux4"]'));
      console.log(`Found ${productCards.length} product cards on the page`);
      
      return productCards.map(card => {
        try {
          // Generate a unique ID
          const id = `instamart_html_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
            
          // Get product name
          const nameElement = card.querySelector('.novMV') || card.querySelector('.sc-aXZVg.kyEzVU');
          const name = nameElement ? nameElement.textContent.trim() : "Unknown Product";
          
          // Get current price
          const priceElement = card.querySelector('[data-testid="item-offer-price"]');
          const price = priceElement ? `₹${priceElement.textContent.trim()}` : "Price unavailable";
          
          // Get original price if available
          const originalPriceElement = card.querySelector('[data-testid="item-mrp-price"]');
          const originalPrice = originalPriceElement ? `₹${originalPriceElement.textContent.trim()}` : null;
          
          // Get discount/savings if available
          const discountElement = card.querySelector('[data-testid="item-offer-label-discount-text"]');
          const discount = discountElement ? discountElement.textContent.trim() : null;
          
          // Get quantity/weight
          const weightElement = card.querySelector('._3eIPt') || card.querySelector('.sc-aXZVg.entQHA');
          const quantity = weightElement ? weightElement.textContent.split('chevronDownIcon')[0].trim() : "1 item";
          
          // Get image URL
          const imageElement = card.querySelector('img.sc-dcJsrY') || card.querySelector('._1NxA5') || card.querySelector('.tPMI1');
          const imageUrl = imageElement ? imageElement.getAttribute('src') : "";
          
          // Check availability - if "Sold Out" text exists, the product is unavailable
          const soldOutElement = card.querySelector('[data-testid="sold-out"]');
          const available = !soldOutElement;
          
          // Get product description if available
          const descElement = card.querySelector('[data-testid="small-description"]');
          const description = descElement ? descElement.textContent.trim() : null;
          
          // Calculate savings from price and originalPrice if available
          let savings = null;
          if (price && originalPrice) {
            const priceValue = parseFloat(price.replace('₹', '').trim());
            const originalPriceValue = parseFloat(originalPrice.replace('₹', '').trim());
            if (!isNaN(priceValue) && !isNaN(originalPriceValue)) {
              savings = `₹${(originalPriceValue - priceValue).toFixed(2)}`;
            }
          }
          
          return {
            id,
            name,
            price,
            originalPrice,
            savings,
            quantity,
            deliveryTime: "10 mins", // As requested, default to 10 mins for deliveryTime
            discount,
            description,
            imageUrl,
            available,
            source: "instamart"
          };
        } catch (err) {
          console.error("Error extracting product data:", err);
          return null;
        }
      }).filter(product => product !== null);
    });
    
    console.log(`Extracted ${products.length} products from HTML structure`);
    return products;
  } catch (error) {
    console.error("Error extracting products from HTML:", error);
    return [];
  }
}

module.exports = {
  navigateToSearch,
  ensureContentLoaded,
  extractProductInformation,
  extractProductsFromHTML
};

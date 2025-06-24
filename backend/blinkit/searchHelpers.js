async function navigateToSearch(page, searchTerm) {
  console.log(`Directly navigating to search URL with term: ${searchTerm}`);
  
  try {
    const encodedSearchTerm = encodeURIComponent(searchTerm);
    console.log(`Going to: https://blinkit.com/s/?q=${encodedSearchTerm}`);
    const response = await page.goto(`https://blinkit.com/s/?q=${encodedSearchTerm}`, {
      waitUntil: 'networkidle2', 
      timeout: 50000
    });
    
    const url = await page.url();
    console.log(`Current page URL: ${url}`);
    await new Promise(resolve => setTimeout(resolve, 2000));
    return true;
  } catch (error) {
    console.log(`Error navigating to search URL: ${error.message}`);
    return false;
  }
}
async function ensureContentLoaded(page) {
  try {
    try {
      const loadingSelector = '.LoadingIcon, .spinner, [class*="loading"], [class*="Loading"]';
      const hasLoadingIndicator = await page.$(loadingSelector);
      
      if (hasLoadingIndicator) {
        await page.waitForSelector(loadingSelector, { hidden: true, timeout: 10000 });
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    } catch (loadingError) {
      console.log("No loading indicator found or timeout waiting for it to disappear");
    }
    
    const contentSelectors = [
      'div[role="button"][id]', 
      'div[id][data-pf="reset"]',
      '.ProductCard__Wrapper',
      '[data-testid*="product"]',
      'div.tw-flex-col[id]',
      'div[class*="product"]'
    ];
    
    let contentFound = false;
    
    for (const selector of contentSelectors) {
      try {
        await page.waitForSelector(selector, { timeout: 3000 });
        console.log(`Found content with selector: ${selector}`);
        contentFound = true;
        break;
      } catch (error) {
        console.log(`Selector ${selector} not found: ${error.message}`);
      }
    }
    
    if (!contentFound) {
      try {
        const noResultsSelector = '.EmptySearchResults, [class*="empty"], [class*="no-results"]';
        const hasNoResults = await page.$(noResultsSelector);
        
        if (hasNoResults) {
          console.log("Found 'no results' indicator");
          return true;
        }
      } catch (noResultsError) {
        console.log("No 'no results' indicator found");
      }
      
      console.log("No standard content selectors found, waiting extra time...");
      await new Promise(resolve => setTimeout(resolve, 5000)); 
      const hasContent = await page.evaluate(() => {
        const hasImages = document.querySelectorAll('img').length > 3;
        const hasPrices = Array.from(document.querySelectorAll('*')).some(el => 
          el.textContent && el.textContent.includes('₹'));
        
        return hasImages || hasPrices;
      });
      
      if (hasContent) {
        console.log("Found generic content indicators");
        contentFound = true;
      }
    }
    return contentFound;
  } catch (error) {
    console.log(`Error ensuring content loaded: ${error.message}`);
    return true;
  }
}

// Updated function to process JSON response
function extractProductInformation(productJsonResponse) {
  console.log("Extracting product information from JSON response...");
  const products = [];

  if (!productJsonResponse || !productJsonResponse.response || !Array.isArray(productJsonResponse.response.snippets)) {
    console.error("Error: Invalid JSON structure. Expected 'response.snippets' array.", productJsonResponse);
    return products;
  }

  const snippets = productJsonResponse.response.snippets;

  snippets.forEach((snippet, index) => {
    // Skip non-product snippets (e.g., headers like "image_text_vr_type_header" or where essential data is missing)
    // A more robust check might be needed depending on other possible widget_types
    if (!snippet.data || snippet.widget_type === "image_text_vr_type_header" || !snippet.data.name || !snippet.data.identity || snippet.data.identity.id === "product_container") {
      console.log(`Skipping snippet at index ${index} as it does not appear to be a product.`);
      return; // Skips this iteration
    }

    const rawProductData = snippet.data;

    try {
      const id = rawProductData.identity.id || `product_${index}`;
      const name = rawProductData.name && rawProductData.name.text ? rawProductData.name.text : 'Product Name Not Available';

      let price = 'Price Not Available';
      if (rawProductData.normal_price && rawProductData.normal_price.text) {
        price = rawProductData.normal_price.text; // e.g., "₹18"
      } else if (rawProductData.price && typeof rawProductData.price === 'number') { // Fallback for numeric price
        price = `₹${rawProductData.price.toFixed(2)}`;
      }


      let originalPrice = null;
      if (rawProductData.mrp && rawProductData.mrp.text) {
        originalPrice = rawProductData.mrp.text; // e.g., "₹20"
      }

      const quantity = rawProductData.variant && rawProductData.variant.text ? rawProductData.variant.text : 'N/A'; // e.g., "67 g"
      const imageUrl = rawProductData.image && rawProductData.image.url ? rawProductData.image.url : '';

      // Delivery time might need more specific logic if "earliest" is not sufficient
      const deliveryTime = rawProductData.eta_tag && rawProductData.eta_tag.title && rawProductData.eta_tag.title.text ? rawProductData.eta_tag.title.text : 'N/A';
      
      let discount = null;
      if (rawProductData.offer_tag && rawProductData.offer_tag.title && rawProductData.offer_tag.title.text) {
        discount = rawProductData.offer_tag.title.text.replace(/\n/g, ' '); // e.g., "10% OFF"
      }

      // Availability based on is_sold_out or inventory
      const available = rawProductData.hasOwnProperty('is_sold_out') ? !rawProductData.is_sold_out :
                        (rawProductData.hasOwnProperty('inventory') ? rawProductData.inventory > 0 : true);


      let savings = null;
      if (originalPrice && price) {
        const priceMatch = price.match(/₹\s*(\d+(?:\.\d+)?)/);
        const originalPriceMatch = originalPrice.match(/₹\s*(\d+(?:\.\d+)?)/);
        
        if (priceMatch && originalPriceMatch) {
          const currentPriceNum = parseFloat(priceMatch[1]);
          const originalPriceNum = parseFloat(originalPriceMatch[1]);
          
          if (!isNaN(originalPriceNum) && !isNaN(currentPriceNum) && originalPriceNum > currentPriceNum) {
            savings = `₹${(originalPriceNum - currentPriceNum).toFixed(0)}`;
          }
        }
      }

      products.push({
        id,
        name,
        price,
        originalPrice,
        savings,
        quantity,
        deliveryTime,
        discount,
        imageUrl,
        available
      });

    } catch (error) {
      console.error(`Error processing product data for snippet at index ${index}: ${error.message}`, rawProductData);
    }
  });

  console.log(`Successfully processed ${products.length} products from JSON response.`);
  return products;
}

module.exports = {
  ensureContentLoaded,
  extractProductInformation,
  navigateToSearch
};

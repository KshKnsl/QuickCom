async function navigateToSearch(page, searchTerm) {
  console.log(`Directly navigating to Zepto search URL with term: ${searchTerm}`);
  
  try {
    const encodedSearchTerm = encodeURIComponent(searchTerm);
    console.log(`Going to: https://www.zeptonow.com/srp?q=${encodedSearchTerm}`);
    const response = await page.goto(`https://www.zeptonow.com/srp?q=${encodedSearchTerm}`, {
      waitUntil: 'networkidle2', 
      timeout: 50000
    });
    
    const url = await page.url();
    console.log(`Current page URL: ${url}`);
    await new Promise(resolve => setTimeout(resolve, 2000));
    return true;
  } catch (error) {
    console.log(`Error navigating to Zepto search URL: ${error.message}`);
    return false;
  }
}

async function ensureContentLoaded(page) {
  try {
    try {
      const loadingSelector = '.loading-container, .loading, .spinner, [class*="loading"], [class*="skeleton"]';
      const hasLoadingIndicator = await page.$(loadingSelector);
      
      if (hasLoadingIndicator) {
        await page.waitForSelector(loadingSelector, { hidden: true, timeout: 10000 });
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      
      // Alternative: wait for product grid to appear
      await page.waitForSelector('.product-card, .product-item, [data-testid="product-card"]', { timeout: 8000 })
        .catch(e => console.log('No product cards found, continuing anyway'));
      
      return true;
    } catch (error) {
      console.log(`Timeout waiting for content to load: ${error.message}`);
      return false;
    }
  } catch (error) {
    console.log(`Error ensuring content loaded: ${error.message}`);
    return false;
  }
}

function extractProductInformation(productJsonResponse) {
  try {
    console.log("Extracting Zepto product information from JSON...");

    // Check if we have the expected structure in the JSON response
    if (!productJsonResponse || !productJsonResponse.response || !productJsonResponse.response.snippets) {
      throw new Error("Invalid product JSON structure");
    }

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
          id: productData.identity.id || `zepto_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`,
          name: productData.name || "Unknown Product",
          price: productData.final_price ? `₹${productData.final_price}` : "Price unavailable",
          originalPrice: productData.price ? `₹${productData.price}` : null,
          savings: productData.price && productData.final_price ? 
            `₹${(parseFloat(productData.price) - parseFloat(productData.final_price)).toFixed(2)}` : null,
          quantity: productData.weight || productData.quantity || "1 item",
          deliveryTime: productData.delivery_time || "10 mins",
          discount: productData.discount_text || (
            productData.price && productData.final_price ? 
            `${Math.round(((parseFloat(productData.price) - parseFloat(productData.final_price)) / parseFloat(productData.price)) * 100)}% OFF` : null
          ),
          imageUrl: productData.image_url || productData.img_url || "",
          available: !productData.out_of_stock,
          source: "zepto"
        };

        products.push(product);
      } catch (error) {
        console.error(`Error processing individual Zepto product:`, error);
        // Continue to next product
      }
    }

    console.log(`Extracted ${products.length} Zepto products`);
    return products;
  } catch (error) {
    console.error("Error extracting Zepto product information:", error);
    return [];
  }
}

module.exports = {
  navigateToSearch,
  ensureContentLoaded,
  extractProductInformation
};

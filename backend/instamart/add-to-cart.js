async function handleAddToCart(page, productId, ws) {
  try {
    const isAvailableCheck = await page.evaluate((id) => {
      const productEl = document.querySelector(
        `[data-testid="${id}"], [data-product-id="${id}"], [data-id="${id}"], #${id}`
      );
      if (!productEl)
        return { available: false, reason: "Product not found on page" };

      const outOfStockEl = productEl.querySelector(
        '[class*="outOfStock"], [class*="out-of-stock"], .sold-out'
      );
      if (outOfStockEl)
        return { available: false, reason: "Product is out of stock" };

      const addButton = productEl.querySelector(
        'button.add-btn, .add-to-cart-button, button[aria-label*="add"], button:has(.plus-icon)'
      );
      if (!addButton)
        return { available: false, reason: "Add button not found" };

      const style = window.getComputedStyle(addButton);
      if (
        style.pointerEvents === "none" ||
        style.cursor === "not-allowed" ||
        style.opacity === "0.5" ||
        addButton.disabled
      ) {
        return { available: false, reason: "Add button is disabled" };
      }

      return { available: true };
    }, productId);

    if (!isAvailableCheck.available) {
      ws.send(
        JSON.stringify({
          status: "error",
          action: "addToCart",
          productId,
          service: "instamart",
          message: `Cannot add product to cart: ${isAvailableCheck.reason}`,
        })
      );
      return;
    }

    const buttonSelectors = [
      `[data-testid="${productId}"] .add-btn, [data-testid="${productId}"] .add-to-cart-button`,
      `[data-product-id="${productId}"] .add-btn, [data-product-id="${productId}"] .add-to-cart-button`,
      `[data-id="${productId}"] .add-btn, [data-id="${productId}"] .add-to-cart-button`,
      `#${productId} .add-btn, #${productId} .add-to-cart-button`,
      `[data-testid="${productId}"] button[aria-label*="add"], [data-testid="${productId}"] button:has(.plus-icon)`,
      `[data-product-id="${productId}"] button[aria-label*="add"], [data-product-id="${productId}"] button:has(.plus-icon)`,
      `[data-id="${productId}"] button[aria-label*="add"], [data-id="${productId}"] button:has(.plus-icon)`,
      `#${productId} button[aria-label*="add"], #${productId} button:has(.plus-icon)`,
    ];

    let addSuccess = false;

    for (const selector of buttonSelectors) {
      try {
        console.log(
          `Trying to find Instamart ADD button with selector: ${selector}`
        );
        const buttonExists = await page.$(selector);

        if (buttonExists) {
          await page.waitForSelector(selector, { timeout: 2000 });
          await page.click(selector);
          console.log(
            `Successfully clicked Instamart ADD button with selector: ${selector}`
          );
          // Wait a moment to see if a counter appears (indicating success)
          await new Promise((resolve) => setTimeout(resolve, 1000));
          addSuccess = true;
          break;
        }
      } catch (error) {
        console.log(
          `Failed to click with Instamart selector ${selector}: ${error.message}`
        );
      }
    }

    if (!addSuccess) {
      try {
        console.log("Trying JavaScript click as fallback for Instamart");
        addSuccess = await page.evaluate((id) => {
          // Try all possible ways to find the button
          const selectors = [
            `[data-testid="${id}"] .add-btn, [data-testid="${id}"] .add-to-cart-button`,
            `[data-product-id="${id}"] .add-btn, [data-product-id="${id}"] .add-to-cart-button`,
            `[data-id="${id}"] .add-btn, [data-id="${id}"] .add-to-cart-button`,
            `#${id} .add-btn, #${id} .add-to-cart-button`,
            // Generic add to cart buttons nearby the product
            `[data-testid="${id}"] button`,
            `[data-product-id="${id}"] button`,
            `[data-id="${id}"] button`,
            `#${id} button`,
          ];

          for (const selector of selectors) {
            const buttons = document.querySelectorAll(selector);
            for (const button of buttons) {
              try {
                button.click();
                return true;
              } catch (e) {
                console.log("Error clicking Instamart button:", e);
              }
            }
          }
          return false;
        }, productId);
      } catch (error) {
        console.log(
          "JavaScript click fallback for Instamart failed:",
          error.message
        );
      }
    }

    if (addSuccess) {
      ws.send(
        JSON.stringify({
          status: "success",
          action: "addToCart",
          service: "instamart",
          productId,
          message: "Product added to Instamart cart",
        })
      );
    } else {
      ws.send(
        JSON.stringify({
          status: "error",
          action: "addToCart",
          service: "instamart",
          productId,
          message:
            "Failed to add product to Instamart cart after multiple attempts",
        })
      );
    }
  } catch (error) {
    console.error("Error in Instamart handleAddToCart:", error);
    ws.send(
      JSON.stringify({
        status: "error",
        action: "addToCart",
        service: "instamart",
        productId,
        message: `Error adding product to Instamart cart: ${error.message}`,
      })
    );
  }
}

module.exports = { handleAddToCart };
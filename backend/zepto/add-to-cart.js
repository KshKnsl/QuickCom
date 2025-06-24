async function handleAddToCart(page, productId, ws) {
  try {
    const isAvailableCheck = await page.evaluate((id) => {
      const productEl = document.querySelector(
        `[data-product-id="${id}"], [data-id="${id}"], #${id}`
      );
      if (!productEl)
        return { available: false, reason: "Product not found on page" };

      const outOfStockEl = productEl.querySelector(
        '[class*="OutOfStock"], [class*="out-of-stock"], .sold-out'
      );
      if (outOfStockEl)
        return { available: false, reason: "Product is out of stock" };

      const addButton = productEl.querySelector(
        'button.add-btn, .add-to-cart, [class*="AddButton"]'
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
          service: "zepto",
          message: `Cannot add product to cart: ${isAvailableCheck.reason}`,
        })
      );
      return;
    }

    const buttonSelectors = [
      `[data-product-id="${productId}"] button.add-btn, [data-product-id="${productId}"] .add-to-cart`,
      `[data-id="${productId}"] button.add-btn, [data-id="${productId}"] .add-to-cart`,
      `#${productId} button.add-btn, #${productId} .add-to-cart`,
      `[data-product-id="${productId}"] [class*="AddButton"]`,
      `[data-id="${productId}"] [class*="AddButton"]`,
      `#${productId} [class*="AddButton"]`,
    ];

    let addSuccess = false;

    for (const selector of buttonSelectors) {
      try {
        console.log(
          `Trying to find Zepto ADD button with selector: ${selector}`
        );
        const buttonExists = await page.$(selector);

        if (buttonExists) {
          await page.waitForSelector(selector, { timeout: 2000 });
          await page.click(selector);
          console.log(
            `Successfully clicked Zepto ADD button with selector: ${selector}`
          );
          // Wait a moment to see if a counter appears (indicating success)
          await new Promise((resolve) => setTimeout(resolve, 1000));
          addSuccess = true;
          break;
        }
      } catch (error) {
        console.log(
          `Failed to click with Zepto selector ${selector}: ${error.message}`
        );
      }
    }

    if (!addSuccess) {
      try {
        console.log("Trying JavaScript click as fallback for Zepto");
        addSuccess = await page.evaluate((id) => {
          // Try all possible ways to find the button
          const selectors = [
            `[data-product-id="${id}"] button.add-btn, [data-product-id="${id}"] .add-to-cart`,
            `[data-id="${id}"] button.add-btn, [data-id="${id}"] .add-to-cart`,
            `#${id} button.add-btn, #${id} .add-to-cart`,
            `[data-product-id="${id}"] [class*="AddButton"]`,
            `[data-id="${id}"] [class*="AddButton"]`,
            `#${id} [class*="AddButton"]`,
            // Generic add to cart buttons nearby the product
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
                console.log("Error clicking Zepto button:", e);
              }
            }
          }
          return false;
        }, productId);
      } catch (error) {
        console.log("JavaScript click fallback for Zepto failed:", error.message);
      }
    }

    if (addSuccess) {
      ws.send(
        JSON.stringify({
          status: "success",
          action: "addToCart",
          service: "zepto",
          productId,
          message: "Product added to Zepto cart",
        })
      );
    } else {
      ws.send(
        JSON.stringify({
          status: "error",
          action: "addToCart",
          service: "zepto",
          productId,
          message: "Failed to add product to Zepto cart after multiple attempts",
        })
      );
    }
  } catch (error) {
    console.error("Error in Zepto handleAddToCart:", error);
    ws.send(
      JSON.stringify({
        status: "error",
        action: "addToCart",
        service: "zepto",
        productId,
        message: `Error adding product to Zepto cart: ${error.message}`,
      })
    );
  }
}

module.exports = { handleAddToCart };
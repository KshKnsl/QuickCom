async function handleAddToCart(page, productId, ws) {
  try {
    const isAvailableCheck = await page.evaluate((id) => {
      const productEl = document.getElementById(id);
      if (!productEl)
        return { available: false, reason: "Product not found on page" };

      const outOfStockEl = productEl.querySelector(
        '[class*="OutOfStock"], [class*="out-of-stock"]'
      );
      if (outOfStockEl)
        return { available: false, reason: "Product is out of stock" };

      const addButton = productEl.querySelector(
        '.tw-rounded-md div, .tw-rounded-md button, [role="button"] div'
      );
      if (!addButton)
        return { available: false, reason: "Add button not found" };
      const style = window.getComputedStyle(addButton);
      if (
        style.pointerEvents === "none" ||
        style.cursor === "not-allowed" ||
        style.opacity === "0.5"
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
          message: `Cannot add product to cart: ${isAvailableCheck.reason}`,
        })
      );
      return;
    }

    const buttonSelectors = [
      `#${productId} .tw-rounded-md > div`,
      `#${productId} .tw-rounded-md`,
      `#${productId} div[role="button"]`,
      `div#${productId} .tw-text-base-green`,
      `[id="${productId}"] .tw-rounded-md`,
      `[id="${productId}"] [role="button"]`,
    ];

    let addSuccess = false;

    for (const selector of buttonSelectors) {
      try {
        console.log(
          `Trying to find ADD button with selector: ${selector}`
        );
        const buttonExists = await page.$(selector);

        if (buttonExists) {
          await page.waitForSelector(selector, { timeout: 2000 });
          await page.click(selector);
          console.log(
            `Successfully clicked ADD button with selector: ${selector}`
          );
          // Wait a moment to see if a counter appears (indicating success)
          await new Promise((resolve) => setTimeout(resolve, 1000));
          addSuccess = true;
          break;
        }
      } catch (error) {
        console.log(
          `Failed to click with selector ${selector}: ${error.message}`
        );
      }
    }

    if (!addSuccess) {
      try {
        console.log("Trying JavaScript click as fallback");
        addSuccess = await page.evaluate((id) => {
          const productEl = document.getElementById(id);
          if (!productEl) return false;

          const possibleButtons = [
            productEl.querySelector(".tw-rounded-md"),
            productEl.querySelector('[role="button"]'),
            productEl.querySelector("button"),
            productEl.querySelector('[tabindex="0"]'),
          ].filter(Boolean);

          for (const btn of possibleButtons) {
            try {
              btn.click();
              return true;
            } catch (e) {
              console.log("Error clicking button:", e);
            }
          }
          return false;
        }, productId);
      } catch (error) {
        console.log("JavaScript click fallback failed:", error.message);
      }
    }

    if (addSuccess) {
      ws.send(
        JSON.stringify({
          status: "success",
          action: "addToCart",
          productId,
          message: "Product added to cart",
        })
      );
    } else {
      ws.send(
        JSON.stringify({
          status: "error",
          action: "addToCart",
          productId,
          message:
            "Failed to add product to cart after multiple attempts",
        })
      );
    }
  } catch (error) {
    console.error("Error in handleAddToCart:", error);
    ws.send(
      JSON.stringify({
        status: "error",
        action: "addToCart",
        productId,
        message: `Error adding product to cart: ${error.message}`,
      })
    );
  }
}

module.exports = { handleAddToCart };
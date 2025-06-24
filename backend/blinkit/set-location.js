async function setBlinkitLocation(page, location) {
  console.log(`Setting Blinkit location to: ${location}`);
  try {
    if (!page.url().includes("blinkit.com")) {
      await page.goto("https://blinkit.com/");
    }

    await page.waitForSelector('[name="select-locality"]');
    await page.click('[name="select-locality"]');
    await page.waitForSelector('[name="select-locality"]:not([disabled])');
    await page.type('[name="select-locality"]', location);
    await new Promise((resolve) => setTimeout(resolve, 2000));
    await page.waitForSelector(
      ".LocationSearchList__LocationListContainer-sc-93rfr7-0:nth-child(1)"
    );
    await page.click(
      ".LocationSearchList__LocationListContainer-sc-93rfr7-0:nth-child(1)"
    );
    await new Promise((resolve) => setTimeout(resolve, 2000));
    locationTitle = await isLocationSet(page);
    if (locationTitle && locationTitle !== "400") {
      console.log(`Location successfully set to: ${locationTitle}`);
      return locationTitle; 
    } else {
      console.log(`Failed to verify location after setting to: ${location}`);
      return null; 
    }
  } catch (error) {
    console.error("Error setting Blinkit location:", error);
    return null;
  }
}

async function isLocationSet(page) {
  console.log("Checking if location is set by looking for ETA container...");
  const etaContainerSelector = '[class^="LocationBar__EtaContainer-"]';
  const titleSelector = '[class^="LocationBar__Subtitle-"]';

  try {
    await page.waitForSelector(etaContainerSelector, {
      timeout: 5000,
      visible: true,
    });
    const titleText = await page.$eval(
      `${etaContainerSelector} ${titleSelector}`,
      (el) => el.textContent.trim()
    );
    if (titleText) {
      console.log(`Location title found: "${titleText}"`);
      return titleText;
    } else {
      return "400";
    }
  } catch (error) {
    console.log(
      "Location ETA container not found within 5 seconds or error during check."
    );
    return "400";
  }
}

module.exports = {
  setBlinkitLocation,
  isLocationSet,
};

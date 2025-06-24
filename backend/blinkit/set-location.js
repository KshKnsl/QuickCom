async function setBlinkitLocation(page, loc) {
  console.log(`Setting Blinkit location to: ${loc}`);
  try {
    if (!page.url().includes("blinkit.com")) {
      await page.goto("https://blinkit.com/");
    }

    await page.waitForSelector('[name="select-locality"]');
    await page.click('[name="select-locality"]');
    await page.waitForSelector('[name="select-locality"]:not([disabled])');
    await page.type('[name="select-locality"]', loc);
    await new Promise((r) => setTimeout(r, 2000));
    await page.waitForSelector(
      ".LocationSearchList__LocationListContainer-sc-93rfr7-0:nth-child(1)"
    );
    await page.click(
      ".LocationSearchList__LocationListContainer-sc-93rfr7-0:nth-child(1)"
    );
    await new Promise((r) => setTimeout(r, 2000));
    let locTitle = await isLocationSet(page);
    if (locTitle && locTitle !== "400") {
      console.log(`Location successfully set to: ${locTitle}`);
      return locTitle; 
    } else {
      console.log(`Failed to verify location after setting to: ${loc}`);
      return null; 
    }
  } catch (err) {
    console.error("Error setting Blinkit location:", err);
    return null;
  }
}

async function isLocationSet(page) {
  console.log("Checking if location is set by looking for ETA container...");
  const etaSel = '[class^="LocationBar__EtaContainer-"]';
  const titleSel = '[class^="LocationBar__Subtitle-"]';

  try {
    await page.waitForSelector(etaSel, {
      timeout: 5000,
      visible: true,
    });
    const txt = await page.$eval(
      `${etaSel} ${titleSel}`,
      (el) => el.textContent.trim()
    );
    if (txt) {
      console.log(`Location title found: "${txt}"`);
      return txt;
    } else {
      return "400";
    }
  } catch (err) {
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

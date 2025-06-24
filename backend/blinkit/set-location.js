async function setBlinkitLocation(page, loc) {
  console.log(`Setting Blinkit location to: ${loc}`);
  try {
    if (!page.url().includes("blinkit.com")) {
      await page.goto("https://blinkit.com/", {
        waitUntil: "domcontentloaded",
        timeout: 300000,
      });
    }
    try {
      await page.waitForSelector('[name="select-locality"]', {
        timeout: 20000,
      });
    } catch (err) {
      console.log(
        "Location selector not found after 20s, attempting to proceed anyway"
      );
    }

    await page
      .click('[name="select-locality"]')
      .catch((e) => console.log("Click failed, retrying..."));

    await page
      .waitForFunction(
        () => {
          const element = document.querySelector('[name="select-locality"]');
          return element && !element.disabled;
        },
        { timeout: 20000 }
      )
      .catch((e) =>
        console.log("Proceeded without confirmation of enabled input")
      );

    await page.type('[name="select-locality"]', loc);
    await new Promise((r) => setTimeout(r, 3000));
    try {
      await page.waitForSelector(
        ".LocationSearchList__LocationListContainer-sc-93rfr7-0:nth-child(1)",
        { timeout: 10000 }
      );
      await page.click(
        ".LocationSearchList__LocationListContainer-sc-93rfr7-0:nth-child(1)"
      );
    } catch (err) {
      console.log("Using alternative selector for location list");
      await page
        .$$eval('[class*="LocationSearchList"]', (elements) => {
          if (elements.length > 0) elements[0].click();
        })
        .catch((e) => console.log("Alternative selection also failed"));
    }

    await new Promise((r) => setTimeout(r, 3000));
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
      timeout: 8000, // Increased timeout
      visible: true,
    });

    const txt = await page
      .$eval(`${etaSel} ${titleSel}`, (el) => el.textContent.trim())
      .catch(() => "");

    if (txt) {
      console.log(`Location title found: "${txt}"`);
      return txt;
    } else {
      return "400";
    }
  } catch (err) {
    console.log(
      "Location ETA container not found within 8 seconds or error during check."
    );
    return "400";
  }
}

module.exports = {
  setBlinkitLocation,
  isLocationSet,
};

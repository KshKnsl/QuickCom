const express = require("express");
const http = require("http");
const ws = require("ws");
const cors = require("cors");
const puppet = require("puppeteer");
const morgan = require("morgan");
const path = require("path");
require("dotenv").config();

// Define supported services
const SVCS = ["blinkit", "zepto", "instamart"];

// Import service helpers dynamically
const svcHelpers = {};
SVCS.forEach((svc) => {
  svcHelpers[svc] = {
    search: require(`./${svc}/searchHelpers.js`),
    location: require(`./${svc}/set-location.js`),
  };
});

const app = express();
const srv = http.createServer(app);
const wss = new ws.Server({ server: srv });

// Configure CORS with options
app.use(
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:5173",
    credentials: true,
  })
);
app.use(express.json());
app.use(morgan("dev"));

// Simple static file serving
app.use(express.static(path.join(__dirname, "../public")));

// Health check endpoint
app.get("/api/health", (req, res) => {
  res.status(200).json({
    status: "ok",
    timestamp: new Date().toISOString(),
  });
});

// Client tracking maps
const browsers = new Map(); // Structure: { cid: { svc: browser } }
const pages = new Map();    // Structure: { cid: { svc: page } }
const locSet = new Map();   // Structure: { cid: { svc: bool } }

// WebSocket connection handler
wss.on("connection", (socket) => {
  const cid = Math.random().toString(36).substring(2, 15);
  console.log(`Client connected: ${cid}`);

  // Initialize client tracking
  browsers.set(cid, {});
  pages.set(cid, {});
  locSet.set(cid, {});

  // Send initial connection acknowledgment
  socket.send(JSON.stringify({ type: "connected", cid }));
  socket.on("message", async (msg) => {
    try {
      const data = JSON.parse(msg);
      console.log(`Received message from ${cid}:`, data.type);

      // Validate service
      if (data.service && !SVCS.includes(data.service)) {
        return sendErr(socket, "Invalid service specified");
      }

      switch (data.type) {
        case "set-location":
          await setLoc(socket, cid, data);
          break;
        case "search":
          await search(socket, cid, data);
          break;
        case "close-browser":
          await closeBrowser(socket, cid, data);
          break;
        default:
          sendErr(socket, `Unknown message type: ${data.type}`);
      }    } catch (err) {
      console.error("Error processing message:", err);
      sendErr(socket, err.message);
    }
  });

  // Handle client disconnection
  socket.on("close", async () => {
    console.log(`Client disconnected: ${cid}`);
    await cleanup(cid);
  });
});

// Helper function to send error messages
function sendErr(socket, msg) {
  socket.send(
    JSON.stringify({
      type: "error",
      error: msg,
    })
  );
}

// WebSocket message handlers
async function setLoc(socket, cid, data) {
  const { service: svc, location: loc } = data;

  try {
    // Initialize browser and page if needed
    const browser = await initBrowser(cid, svc);
    const page = await getPage(cid, svc, browser);

    // Set location using service-specific helper
    await svcHelpers[svc].location.setLocation(page, loc);

    // Mark location as set for this service
    locSet.get(cid)[svc] = true;

    socket.send(
      JSON.stringify({
        type: "location-set",
        svc,
        loc,
      })
    );  } catch (err) {
    console.error(`Error setting location for ${svc}:`, err);
    sendErr(socket, `Failed to set location: ${err.message}`);
  }
}

async function search(socket, cid, data) {
  const { service: svc, query: q } = data;

  try {
    // Check if location is set for this service
    if (!locSet.get(cid)[svc]) {
      return sendErr(socket, `Location not set for ${svc}. Set location first.`);
    }

    // Get existing browser and page
    const b = browsers.get(cid)[svc];
    const p = pages.get(cid)[svc];

    if (!b || !p) {
      return sendErr(socket, `Browser or page not initialized for ${svc}`);
    }

    // Search using service-specific helper
    const prods = await svcHelpers[svc].search.searchProducts(p, q);

    socket.send(
      JSON.stringify({
        type: "search-results",
        svc,
        q,
        products: prods,
      })
    );  } catch (err) {
    console.error(`Error searching ${svc}:`, err);
    sendErr(socket, `Search failed: ${err.message}`);
  }
}

async function closeBrowser(socket, cid, data) {
  const { service: svc } = data;

  try {
    const clientBrowsers = browsers.get(cid);

    if (svc) {
      // Close specific service browser
      if (clientBrowsers && clientBrowsers[svc]) {
        await clientBrowsers[svc].close();
        delete clientBrowsers[svc];

        if (pages.get(cid)) {
          delete pages.get(cid)[svc];
        }

        if (locSet.get(cid)) {
          delete locSet.get(cid)[svc];
        }

        console.log(`Closed ${svc} browser for client ${cid}`);
      }
    } else {
      // Close all browsers for this client
      await cleanup(cid);
    }

    socket.send(
      JSON.stringify({
        type: "browser-closed",
        svc: svc || "all",
      })
    );  } catch (err) {
    console.error(`Error closing browser:`, err);
    sendErr(socket, `Failed to close browser: ${err.message}`);
  }
}

// Handler functions
async function handleSetLocation(socket, cid, data) {
  const pgs = pages.get(cid);
  if (
    !pgs ||
    !pgs.blinkit ||
    !pgs.zepto ||
    !pgs.instamart
  ) {
    socket.send(
      JSON.stringify({
        action: "statusUpdate",
        step: "setLocation",
        status: "error",
        success: false,
        message: "Browsers not initialized. Please initialize first.",
      })
    );
    return;
  }
  const { location: loc, services: svcs } = data;
  if (!loc) {
    socket.send(
      JSON.stringify({
        action: "statusUpdate",
        step: "setLocation",
        status: "error",
        success: false,
        message: "No location provided.",
      })
    );
    return;
  }

  const svcToUpdate =
    svcs && Array.isArray(svcs) && svcs.length > 0
      ? svcs.filter((s) => ["blinkit", "zepto", "instamart"].includes(s))
      : ["blinkit", "zepto", "instamart"];
  if (svcToUpdate.length === 0) {
    socket.send(
      JSON.stringify({
        action: "statusUpdate",
        step: "setLocation",
        status: "error",
        success: false,
        message: "No valid services specified for location update.",
      })
    );
    return;
  }

  socket.send(
    JSON.stringify({
      action: "statusUpdate",
      step: "setLocation",
      status: "loading",
      message:
        svcToUpdate.length === 3
          ? `Setting location to ${loc} on all services...`
          : `Setting location to ${loc} on ${svcToUpdate.join(
              ", "
            )}...`,
    })
  );

  try {
    const setLocationPromises = [];

    if (servicesToUpdate.includes("blinkit")) {
      setLocationPromises.push(
        (async () => {
          try {
            const locationTitle = await serviceHelpers.blinkit.location.setBlinkitLocation(
              clientPages.blinkit,
              location
            );
            return {
              service: "blinkit",
              success: !!locationTitle,
              title: locationTitle || null,
            };
          } catch (error) {
            console.error(`Error setting Blinkit location:`, error);
            return {
              service: "blinkit",
              success: false,
              error: error.message,
            };
          }
        })()
      );
    }

    if (servicesToUpdate.includes("zepto")) {
      setLocationPromises.push(
        (async () => {
          try {
            const locationTitle = await serviceHelpers.zepto.location.setZeptoLocation(
              clientPages.zepto,
              location
            );
            return {
              service: "zepto",
              success: !!locationTitle,
              title: locationTitle || null,
            };
          } catch (error) {
            console.error(`Error setting Zepto location:`, error);
            return {
              service: "zepto",
              success: false,
              error: error.message,
            };
          }
        })()
      );
    }

    if (servicesToUpdate.includes("instamart")) {
      setLocationPromises.push(
        (async () => {
          try {
            const locationTitle = await serviceHelpers.instamart.location.setInstamartLocation(
              clientPages.instamart,
              location
            );
            return {
              service: "instamart",
              success: !!locationTitle,
              title: locationTitle || null,
            };
          } catch (error) {
            console.error(`Error setting Instamart location:`, error);
            return {
              service: "instamart",
              success: false,
              error: error.message,
            };
          }
        })()
      );
    }

    const results = await Promise.all(setLocationPromises);

    const locationStatus = locationSet.get(clientId) || {
      blinkit: false,
      zepto: false,
      instamart: false,
    };

    let anySuccess = false;
    let locationTitles = {};
    let failedServices = [];

    results.forEach((result) => {
      locationStatus[result.service] = result.success;
      if (result.success) {
        anySuccess = true;
        locationTitles[result.service] = result.title;
      } else {
        failedServices.push(result.service);
      }
    });

    locationSet.set(clientId, locationStatus);

    if (anySuccess) {
      ws.send(
        JSON.stringify({
          action: "statusUpdate",
          step: "setLocation",
          status: "completed",
          success: true,
          locationResults: results,
          failedServices: failedServices,
          message:
            failedServices.length > 0
              ? `Location set successful for some services. Failed for: ${failedServices.join(
                  ", "
                )}`
              : `Location set successful for all requested services`,
        })
      );
    } else {
      ws.send(
        JSON.stringify({
          action: "statusUpdate",
          step: "setLocation",
          status: "error",
          success: false,
          locationResults: results,
          failedServices: failedServices, // Include the list of failed services for retry
          message: `Failed to set location on any service: ${failedServices.join(
            ", "
          )}. Please try again.`,
        })
      );
    }
  } catch (error) {
    console.error("Error in location setting process:", error);
    ws.send(
      JSON.stringify({
        action: "statusUpdate",
        step: "setLocation",
        status: "error",
        success: false,
        message: `Error setting locations: ${error.message}`,
      })
    );
  }
}

async function handleSearch(ws, clientId, data) {
  const searchPages = activePages.get(clientId);
  const locationStatus = locationSet.get(clientId);

  if (
    !searchPages ||
    !searchPages.blinkit ||
    !searchPages.zepto ||
    !searchPages.instamart
  ) {
    ws.send(
      JSON.stringify({
        action: "statusUpdate",
        step: "search",
        status: "error",
        success: false,
        message: "Browsers not initialized. Please initialize first.",
      })
    );
    return;
  }

  const { searchTerm } = data;
  if (!searchTerm) {
    ws.send(
      JSON.stringify({
        action: "statusUpdate",
        step: "search",
        status: "skipped",
        success: false,
        message: "No search term provided.",
      })
    );
    ws.send(
      JSON.stringify({
        status: "info",
        action: "searchResults",
        products: { blinkit: [], zepto: [], instamart: [] },
        message: "Please provide a search term.",
      })
    );
    return;
  }

  // Check if any service has location set
  if (
    !locationStatus.blinkit &&
    !locationStatus.zepto &&
    !locationStatus.instamart
  ) {
    ws.send(
      JSON.stringify({
        action: "statusUpdate",
        step: "search",
        status: "error",
        success: false,
        message:
          "Location not set on any service. Please set location first.",
      })
    );
    return;
  }

  // Notify that search is starting
  ws.send(
    JSON.stringify({
      action: "statusUpdate",
      step: "search",
      status: "loading",
      message: `Searching for "${searchTerm}" across all services...`,
    })
  );

  // Search on each service in parallel
  const searchResults = {
    blinkit: { status: "pending", products: [] },
    zepto: { status: "pending", products: [] },
    instamart: { status: "pending", products: [] },
  };

  // Function to send search progress updates for individual services
  const updateSearchStatus = (
    service,
    status,
    message,
    products = null
  ) => {
    searchResults[service] = {
      status,
      message,
      products: products || searchResults[service].products,
    };

    ws.send(
      JSON.stringify({
        action: "serviceSearchUpdate",
        service,
        status,
        message,
        hasProducts: products ? products.length > 0 : false,
      })
    );
  };

  // Function to run search for a specific service
  const runServiceSearch = async (
    service,
    page,
    navigateToSearch,
    ensureContentLoaded,
    extractProductInformation
  ) => {
    if (!locationStatus[service]) {
      updateSearchStatus(
        service,
        "skipped",
        `Location not set for ${service}.`
      );
      return [];
    }

    updateSearchStatus(
      service,
      "loading",
      `Searching on ${service}...`
    );

    try {
      // Promise to capture product JSON from network responses
      let productJsonResponse = null;
      let responseHandler;

      const productJsonPromise = new Promise((resolve, reject) => {
        responseHandler = async (response) => {
          const url = response.url();
          if (
            response.request().resourceType() === "xhr" ||
            response.request().resourceType() === "fetch"
          ) {
            try {
              const json = await response.json(); // Check for product data format specific to this service, avoiding empty_search URLs
              if (
                json &&
                json.response &&
                Array.isArray(json.response.snippets) &&
                json.response.snippets.some(
                  (s) => s.data && s.data.identity
                ) &&
                !url.includes("empty_search")
              ) {
                console.log(
                  `Captured ${service} product JSON from: ${url}`
                );
                if (page && typeof page.off === "function")
                  page.off("response", responseHandler);
                resolve(json);
              }
            } catch (e) {
              // Not a JSON response or not the one we want
            }
          }
        };

        page.on("response", responseHandler);

        // Timeout to prevent hanging
        setTimeout(() => {
          if (page && typeof page.off === "function")
            page.off("response", responseHandler);
          // Instead of rejecting with error, resolve with a marker to use HTML extraction
          resolve({ useHtmlExtraction: true, page: page });
        }, 30000);
      });

      // Navigate to the search page
      updateSearchStatus(
        service,
        "navigating",
        `Navigating to ${service} search...`
      );
      const navigationSuccess = await navigateToSearch(
        page,
        searchTerm
      );

      if (!navigationSuccess) {
        updateSearchStatus(
          service,
          "error",
          `Failed to navigate to ${service} search page.`
        );
        if (page && typeof page.off === "function" && responseHandler)
          page.off("response", responseHandler);
        return [];
      }

      // Wait for content to load
      updateSearchStatus(
        service,
        "loading_content",
        `Waiting for ${service} content to load...`
      );
      const contentLoaded = await ensureContentLoaded(page);

      // Extract product information - first try from JSON, fallback to HTML if needed
      updateSearchStatus(
        service,
        "extracting",
        `Extracting ${service} products...`
      );
      try {
        productJsonResponse = await productJsonPromise;

        if (
          productJsonResponse &&
          productJsonResponse.useHtmlExtraction
        ) {
          console.log(`Using HTML extraction for ${service}`);
          updateSearchStatus(
            service,
            "extracting",
            `Extracting ${service} products from HTML...`
          );
        }

        // Pass the response with page object to the extraction function
        if (productJsonResponse.useHtmlExtraction) {
          productJsonResponse.page = page;
        }

        const products = await extractProductInformation(
          productJsonResponse
        );

        if (products && products.length > 0) {
          updateSearchStatus(
            service,
            "success",
            `Found ${products.length} products on ${service}.`,
            products
          );
          return products;
        } else {
          updateSearchStatus(
            service,
            "empty",
            `No products found on ${service}.`,
            []
          );
          return [];
        }
      } catch (error) {
        console.error(
          `Error during product extraction for ${service}:`,
          error
        );

        // Final fallback - try direct HTML extraction if everything else failed
        try {
          console.log(
            `Attempting direct HTML extraction for ${service} as final fallback`
          );
          updateSearchStatus(
            service,
            "extracting",
            `Final attempt to extract ${service} products...`
          );

          // Create a simplified wrapper to pass the page
          const htmlProducts = await extractProductInformation({
            useHtmlExtraction: true,
            page: page,
          });

          if (htmlProducts && htmlProducts.length > 0) {
            updateSearchStatus(
              service,
              "success",
              `Found ${htmlProducts.length} products on ${service} via direct HTML extraction.`,
              htmlProducts
            );
            return htmlProducts;
          } else {
            updateSearchStatus(
              service,
              "empty",
              `No products found on ${service}.`,
              []
            );
            return [];
          }
        } catch (fallbackError) {
          console.error(
            `Final extraction attempt failed for ${service}:`,
            fallbackError
          );
          updateSearchStatus(
            service,
            "error",
            `Failed to get product data: ${error.message}`
          );
          return [];
        }
      }
    } catch (error) {
      console.error(`Error in ${service} search:`, error);
      updateSearchStatus(
        service,
        "error",
        `Search error: ${error.message}`
      );
      return [];
    }
  };

  // Start all 3 searches in parallel
  Promise.all([
    runServiceSearch(
      "blinkit",
      searchPages.blinkit,
      serviceHelpers.blinkit.search.navigateToSearch,
      serviceHelpers.blinkit.search.ensureContentLoaded,
      serviceHelpers.blinkit.search.extractProductInformation
    ),
    runServiceSearch(
      "zepto",
      searchPages.zepto,
      serviceHelpers.zepto.search.navigateToSearch,
      serviceHelpers.zepto.search.ensureContentLoaded,
      serviceHelpers.zepto.search.extractProductInformation
    ),
    runServiceSearch(
      "instamart",
      searchPages.instamart,
      serviceHelpers.instamart.search.navigateToSearch,
      serviceHelpers.instamart.search.ensureContentLoaded,
      serviceHelpers.instamart.search.extractProductInformation
    ),
  ])
    .then(([blinkitProducts, zeptoProducts, instamartProducts]) => {
      // Combine all search results
      const allProducts = {
        blinkit: blinkitProducts,
        zepto: zeptoProducts,
        instamart: instamartProducts,
      };

      const totalProducts =
        blinkitProducts.length +
        zeptoProducts.length +
        instamartProducts.length;

      // Send the combined results to the client
      ws.send(
        JSON.stringify({
          status: "success",
          action: "searchResults",
          products: allProducts,
          productCount: {
            blinkit: blinkitProducts.length,
            zepto: zeptoProducts.length,
            instamart: instamartProducts.length,
            total: totalProducts,
          },
          message: `Found ${totalProducts} products across all services.`,
        })
      );

      // Final status update
      ws.send(
        JSON.stringify({
          action: "statusUpdate",
          step: "search",
          status: "completed",
          success: true,
          message: `Search completed for "${searchTerm}".`,
        })
      );
    })
    .catch((error) => {
      console.error("Error in search process:", error);
      ws.send(
        JSON.stringify({
          action: "statusUpdate",
          step: "search",
          status: "error",
          success: false,
          message: `Search error: ${error.message}`,
        })
      );
    });
}

async function handleCloseBrowser(ws, clientId, data) {
  // Close all browsers if they exist
  const clientBrowsers = activeBrowsers.get(clientId);
  if (clientBrowsers) {
    const closePromises = [];

    for (const service of ["blinkit", "zepto", "instamart"]) {
      if (clientBrowsers[service]) {
        closePromises.push(clientBrowsers[service].close());
      }
    }

    await Promise.all(closePromises);

    activeBrowsers.delete(clientId);
    activePages.delete(clientId);
    locationSet.delete(clientId);

    ws.send(
      JSON.stringify({
        status: "success",
        action: "close",
        message: "All browsers closed successfully.",
      })
    );
  } else {
    ws.send(
      JSON.stringify({
        status: "error",
        action: "close",
        message: "No active browsers to close.",
      })
    );
  }
}

// Browser management functions
async function initBrowser(cid, svc) {
  try {
    // Check if browser already exists for this client/service
    if (browsers.get(cid)[svc]) {
      return browsers.get(cid)[svc];
    }

    // Launch browser with appropriate settings
    const b = await puppet.launch({
      headless: "new",
      args: [
        "--disable-setuid-sandbox",
        "--no-sandbox",
        "--single-process",
        "--no-zygote",
      ],
      executablePath: process.env.PUPPETEER_EXEC_PATH,
    });

    // Store browser reference
    browsers.get(cid)[svc] = b;
    return b;
  } catch (err) {
    console.error(`Error initializing browser for ${svc}:`, err);
    throw new Error(`Failed to initialize browser: ${err.message}`);
  }
}

async function getPage(cid, svc, browser) {
  try {
    // Check if page already exists
    if (pages.get(cid)[svc]) {
      return pages.get(cid)[svc];
    }

    // Create new page with appropriate settings
    const p = await browser.newPage();
    await p.setViewport({ width: 1280, height: 800 });
    await p.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
    );

    // Store page reference
    pages.get(cid)[svc] = p;
    return p;
  } catch (err) {
    console.error(`Error creating page for ${svc}:`, err);
    throw new Error(`Failed to create page: ${err.message}`);
  }
}

async function cleanup(cid) {
  try {
    const clientBrowsers = browsers.get(cid);
    if (clientBrowsers) {
      // Close all browsers for this client
      for (const svc in clientBrowsers) {
        const b = clientBrowsers[svc];
        if (b) {
          await b.close();
          console.log(`Closed ${svc} browser for client ${cid}`);
        }
      }
    }

    // Clear all client references
    browsers.delete(cid);
    pages.delete(cid);
    locSet.delete(cid);
  } catch (err) {
    console.error(`Error cleaning up resources for client ${cid}:`, err);
  }
}

const PORT = process.env.PORT || 5000;

app.get("*", (req, res) => {
  if (!req.path.startsWith("/api/")) {
    const publicPath =
      process.env.NODE_ENV === "production" ? "./public" : "../public";
    const indexPath = path.join(__dirname, publicPath, "index.html");

    // Only log in non-production to reduce verbosity
    if (process.env.NODE_ENV !== "production") {
      console.log(`Serving index.html from: ${indexPath}`);
    }

    res.sendFile(indexPath, (err) => {
      if (err) {
        console.error(`Error serving index.html: ${err.message}`);
        res.status(500).send("Error loading the application");
      }
    });
  } else {
    res.status(404).json({ error: "API endpoint not found" });
  }
});

// Start server
srv.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
  console.log(`Available services: ${SVCS.join(", ")}`);
});

// Handle graceful shutdown
process.on("SIGINT", async () => {
  console.log("Shutting down server...");
  
  // Close all active browsers
  for (const [cid] of browsers.entries()) {
    await cleanup(cid);
  }
  
  // Close server
  srv.close(() => {
    console.log("Server shutdown complete");
    process.exit(0);
  });
});

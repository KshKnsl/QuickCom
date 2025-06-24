const express = require("express");
const http = require("http");
const WebSocket = require("ws");
const cors = require("cors");
const puppeteer = require("puppeteer");
const morgan = require("morgan");
const path = require("path");
// Load environment variables from .env file
require("dotenv").config();

const {
  ensureContentLoaded: ensureBlinkitContentLoaded,
  extractProductInformation: extractBlinkitProductInformation,
  navigateToSearch: navigateBlinkitSearch,
} = require("./blinkit/searchHelpers.js");
const {
  setBlinkitLocation,
  isLocationSet: isBlinkitLocationSet,
} = require("./blinkit/set-location.js");

// Zepto imports
const {
  ensureContentLoaded: ensureZeptoContentLoaded,
  extractProductInformation: extractZeptoProductInformation,
  navigateToSearch: navigateZeptoSearch,
} = require("./zepto/searchHelpers.js");
const {
  setZeptoLocation,
  isLocationSet: isZeptoLocationSet,
} = require("./zepto/set-location.js");

// Instamart imports
const {
  ensureContentLoaded: ensureInstamartContentLoaded,
  extractProductInformation: extractInstamartProductInformation,
  navigateToSearch: navigateInstamartSearch,
} = require("./instamart/searchHelpers.js");
const {
  setInstamartLocation,
  isLocationSet: isInstamartLocationSet,
} = require("./instamart/set-location.js");

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Configure CORS with options for production
app.use(
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:5173",
    credentials: true,
  })
);
app.use(express.json());
app.use(morgan(process.env.NODE_ENV === "production" ? "combined" : "dev"));

// Serve static files from the public directory
// For Docker, use './public' instead of '../public' as files are copied to /app/public in the container
const publicPath = process.env.NODE_ENV === "production" ? "./public" : "../public";

// Serve static files with proper caching headers
app.use(express.static(path.join(__dirname, publicPath), {
  etag: true,
  lastModified: true,
  setHeaders: (res, path) => {
    // Cache assets for 30 days
    if (path.endsWith('.js') || path.endsWith('.css') || 
        path.endsWith('.png') || path.endsWith('.jpg') || 
        path.endsWith('.svg')) {
      res.setHeader('Cache-Control', 'public, max-age=2592000');
    }
  }
}));

// Log static file path only when not in production to reduce logs
if (process.env.NODE_ENV !== "production") {
  console.log(`Serving static files from: ${path.join(__dirname, publicPath)}`);
}

// Add health check endpoint for monitoring and deploy checks
app.get("/api/health", (req, res) => {
  res.status(200).json({
    status: "ok",
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || "development",
  });
});

// Store active browsers, pages, and location status for each client and service
const activeBrowsers = new Map(); // Structure: { clientId: { blinkit: browser, zepto: browser, instamart: browser } }
const activePages = new Map(); // Structure: { clientId: { blinkit: page, zepto: page, instamart: page } }
const locationSet = new Map(); // Structure: { clientId: { blinkit: bool, zepto: bool, instamart: bool } }

wss.on("connection", (ws) => {
  console.log("Client connected");
  let clientId = Date.now().toString();

  // Initialize browser and page objects for each service
  const browsers = {
    blinkit: null,
    zepto: null,
    instamart: null,
  };

  const pages = {
    blinkit: null,
    zepto: null,
    instamart: null,
  };

  ws.on("message", async (message) => {
    try {
      const data = JSON.parse(message);
      console.log(`Received message: ${data.action}`);

      switch (data.action) {
        case "initialize":
          ws.send(
            JSON.stringify({
              action: "statusUpdate",
              step: "initialize",
              status: "loading",
              message: "Initializing browsers...",
            })
          );          try {
            // Configure Puppeteer for both local and production environments
            const isProduction = process.env.NODE_ENV === "production";
            const headless = isProduction
              ? false : process.env.PUPPETEER_HEADLESS || false;

            // Common browser launch options
            const puppeteerOptions = {
              headless: headless,
              defaultViewport: { width: 1396, height: 632 },
              args: [
                "--no-sandbox",
                "--disable-setuid-sandbox",
                "--disable-dev-shm-usage",
              ],
            };

            // Add production-specific options
            if (isProduction) {
              puppeteerOptions.args = [
                ...puppeteerOptions.args,
                "--disable-accelerated-2d-canvas",
                "--no-first-run",
                "--no-zygote",
                "--disable-gpu",
                "--single-process",
              ];

              // Only add executablePath if PUPPETEER_EXECUTABLE_PATH is set
              if (process.env.PUPPETEER_EXECUTABLE_PATH) {
                console.log(
                  `Using Chrome executable path: ${process.env.PUPPETEER_EXECUTABLE_PATH}`
                );
                puppeteerOptions.executablePath =
                  process.env.PUPPETEER_EXECUTABLE_PATH;
              } else {
                console.log(
                  "No PUPPETEER_EXECUTABLE_PATH provided, using bundled Chromium"
                );
              }
            }

            // Launch three separate browser instances in parallel
            const launchPromises = [
              puppeteer.launch(puppeteerOptions),
              puppeteer.launch(puppeteerOptions),
              puppeteer.launch(puppeteerOptions),
            ];

            const [blinkitBrowser, zeptoBrowser, instamartBrowser] =
              await Promise.all(launchPromises);

            // Set up the browser instances
            browsers.blinkit = blinkitBrowser;
            browsers.zepto = zeptoBrowser;
            browsers.instamart = instamartBrowser;

            // Create a page for each browser
            pages.blinkit = await browsers.blinkit.newPage();
            pages.zepto = await browsers.zepto.newPage();
            pages.instamart = await browsers.instamart.newPage();

            // Store browser and page references
            activeBrowsers.set(clientId, browsers);
            activePages.set(clientId, pages);

            // Initialize location settings
            locationSet.set(clientId, {
              blinkit: false,
              zepto: false,
              instamart: false,
            });

            ws.send(
              JSON.stringify({
                action: "statusUpdate",
                step: "initialize",
                status: "completed",
                success: true,
                message: "All browsers initialized successfully.",
              })
            );
          } catch (error) {
            console.error("Error initializing browsers:", error);
            ws.send(
              JSON.stringify({
                action: "statusUpdate",
                step: "initialize",
                status: "error",
                success: false,
                message: `Failed to initialize browsers: ${error.message}`,
              })
            );
          }
          break;

        case "setLocation":
          const clientPages = activePages.get(clientId);
          if (
            !clientPages ||
            !clientPages.blinkit ||
            !clientPages.zepto ||
            !clientPages.instamart
          ) {
            ws.send(
              JSON.stringify({
                action: "statusUpdate",
                step: "setLocation",
                status: "error",
                success: false,
                message: "Browsers not initialized. Please initialize first.",
              })
            );
            break;
          }

          const { location } = data;
          if (!location) {
            ws.send(
              JSON.stringify({
                action: "statusUpdate",
                step: "setLocation",
                status: "error",
                success: false,
                message: "No location provided.",
              })
            );
            break;
          }

          ws.send(
            JSON.stringify({
              action: "statusUpdate",
              step: "setLocation",
              status: "loading",
              message: `Setting location to ${location} on all services...`,
            })
          );

          try {
            // Set location for all services in parallel
            const setLocationPromises = [
              (async () => {
                try {
                  const locationTitle = await setBlinkitLocation(
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
              })(),

              (async () => {
                try {
                  const locationTitle = await setZeptoLocation(
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
              })(),

              (async () => {
                try {
                  const locationTitle = await setInstamartLocation(
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
              })(),
            ];

            const results = await Promise.all(setLocationPromises);

            // Update the location set status for all services
            const locationStatus = locationSet.get(clientId);
            let anySuccess = false;
            let locationTitles = {};

            results.forEach((result) => {
              locationStatus[result.service] = result.success;
              if (result.success) {
                anySuccess = true;
                locationTitles[result.service] = result.title;
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
                  locationResults: results, // Send detailed results for all services
                  message: `Location set on one or more services`,
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
                  message: "Failed to set location on any service.",
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
          break;

        case "search":
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
            break;
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
            break;
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
            break;
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
                  reject(
                    new Error(
                      `Timeout waiting for ${service} product JSON response after 30s`
                    )
                  );
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

              // Extract product information from captured network JSON
              updateSearchStatus(
                service,
                "extracting",
                `Extracting ${service} products...`
              );
              try {
                productJsonResponse = await productJsonPromise;
                const products = extractProductInformation(productJsonResponse);

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
                  `Error capturing or processing ${service} product JSON:`,
                  error
                );
                updateSearchStatus(
                  service,
                  "error",
                  `Failed to get product data: ${error.message}`
                );
                return [];
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
              navigateBlinkitSearch,
              ensureBlinkitContentLoaded,
              extractBlinkitProductInformation
            ),
            runServiceSearch(
              "zepto",
              searchPages.zepto,
              navigateZeptoSearch,
              ensureZeptoContentLoaded,
              extractZeptoProductInformation
            ),
            runServiceSearch(
              "instamart",
              searchPages.instamart,
              navigateInstamartSearch,
              ensureInstamartContentLoaded,
              extractInstamartProductInformation
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
              );            });
          break;

        case "close":
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
          break;

        default:
          ws.send(
            JSON.stringify({
              status: "error",
              action: "unknownAction",
              message: `Unknown action: ${data.action}`,
            })
          );
          break;
      }
    } catch (error) {
      console.error("Error processing message:", error);
      ws.send(
        JSON.stringify({
          status: "error",
          action: "processMessage",
          message: `Error processing message: ${error.message}`,
        })
      );
    }
  });

  ws.on("close", () => {
    console.log("Client disconnected");
    // Clean up all browsers if they exist
    const clientBrowsers = activeBrowsers.get(clientId);
    if (clientBrowsers) {
      for (const service of ["blinkit", "zepto", "instamart"]) {
        if (clientBrowsers[service]) {
          clientBrowsers[service].close().catch(console.error);
        }
      }
      activeBrowsers.delete(clientId);
      activePages.delete(clientId);
      locationSet.delete(clientId);
    }
  });
});

const PORT = process.env.PORT || 5000;

// Add a catch-all route to serve the frontend for all non-API routes
app.get("*", (req, res) => {
  // Only handle routes that aren't API routes
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

server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

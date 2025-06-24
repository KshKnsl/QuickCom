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
              await Promise.all(launchPromises);            // Set up the browser instances
            browsers.blinkit = blinkitBrowser;
            browsers.zepto = zeptoBrowser;
            browsers.instamart = instamartBrowser;

            // Get all currently opened pages in each browser
            const [blinkitPages, zeptoPages, instamartPages] = await Promise.all([
              browsers.blinkit.pages(),
              browsers.zepto.pages(),
              browsers.instamart.pages()
            ]);

            // Use the first existing page if available, or create a new one if needed
            pages.blinkit = blinkitPages.length > 0 ? blinkitPages[0] : await browsers.blinkit.newPage();
            pages.zepto = zeptoPages.length > 0 ? zeptoPages[0] : await browsers.zepto.newPage();
            pages.instamart = instamartPages.length > 0 ? instamartPages[0] : await browsers.instamart.newPage();

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

          const { location, services } = data;
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

          // If specific services are provided, only set location for those services
          // Otherwise, set for all services
          const servicesToUpdate = services && Array.isArray(services) && services.length > 0 
            ? services.filter(s => ["blinkit", "zepto", "instamart"].includes(s))
            : ["blinkit", "zepto", "instamart"];
          
          if (servicesToUpdate.length === 0) {
            ws.send(
              JSON.stringify({
                action: "statusUpdate",
                step: "setLocation",
                status: "error",
                success: false,
                message: "No valid services specified for location update.",
              })
            );
            break;
          }

          ws.send(
            JSON.stringify({
              action: "statusUpdate",
              step: "setLocation",
              status: "loading",
              message: servicesToUpdate.length === 3 
                ? `Setting location to ${location} on all services...`
                : `Setting location to ${location} on ${servicesToUpdate.join(", ")}...`,
            })
          );

          try {
            // Only create promises for services that need to be updated
            const setLocationPromises = [];
            
            if (servicesToUpdate.includes("blinkit")) {
              setLocationPromises.push((async () => {
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
              })());
            }

            if (servicesToUpdate.includes("zepto")) {
              setLocationPromises.push((async () => {
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
              })());
            }

            if (servicesToUpdate.includes("instamart")) {
              setLocationPromises.push((async () => {
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
              })());
            }

            const results = await Promise.all(setLocationPromises);

            // Update the location set status for services that were processed
            const locationStatus = locationSet.get(clientId) || {
              blinkit: false,
              zepto: false,
              instamart: false
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
                  failedServices: failedServices, // Include the list of failed services for retry
                  message: failedServices.length > 0 
                    ? `Location set successful for some services. Failed for: ${failedServices.join(', ')}`
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
                  message: `Failed to set location on any service: ${failedServices.join(', ')}. Please try again.`,
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
          
        case "retrySetLocation":
          const retryPages = activePages.get(clientId);
          if (!retryPages) {
            ws.send(
              JSON.stringify({
                action: "statusUpdate",
                step: "retrySetLocation",
                status: "error",
                success: false,
                message: "Browsers not initialized. Please initialize first.",
              })
            );
            break;
          }
          
          const { retryLocation, retryServices } = data;
          if (!retryLocation) {
            ws.send(
              JSON.stringify({
                action: "statusUpdate",
                step: "retrySetLocation",
                status: "error",
                success: false,
                message: "No location provided for retry.",
              })
            );
            break;
          }
          
          // Only retry the specified services
          if (!retryServices || !Array.isArray(retryServices) || retryServices.length === 0) {
            ws.send(
              JSON.stringify({
                action: "statusUpdate",
                step: "retrySetLocation",
                status: "error",
                success: false,
                message: "No services specified for retry.",
              })
            );
            break;
          }
          
          // Forward to the setLocation handler with specific services
          ws.send(JSON.stringify({
            action: "setLocation", 
            location: retryLocation, 
            services: retryServices
          }));
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

            try {              // Promise to capture product JSON from network responses
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
                // Get either JSON response or marker for HTML extraction
                productJsonResponse = await productJsonPromise;
                
                // If it's a fallback marker, attach the page for HTML extraction
                if (productJsonResponse && productJsonResponse.useHtmlExtraction) {
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
                
                const products = await extractProductInformation(productJsonResponse);

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
                  console.log(`Attempting direct HTML extraction for ${service} as final fallback`);
                  updateSearchStatus(
                    service,
                    "extracting",
                    `Final attempt to extract ${service} products...`
                  );
                  
                  // Create a simplified wrapper to pass the page
                  const htmlProducts = await extractProductInformation({ 
                    useHtmlExtraction: true, 
                    page: page 
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
                  console.error(`Final extraction attempt failed for ${service}:`, fallbackError);
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

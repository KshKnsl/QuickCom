"use client"

import { useState, useEffect, useRef } from "react"
import { SearchForm } from "@/components/SearchForm"
import { ProductList } from "@/components/ProductList"
import { Cart } from "@/components/Cart"
import { LoadingIndicator } from "@/components/loading-indicator"
import { ShoppingCart, Package2, AlertCircle, MapPin } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Toaster, toast } from "react-hot-toast"

// Dynamically set WebSocket URL based on current host in production
const getWebsocketUrl = () => {
  const isProduction = import.meta.env.PROD;
  // Use environment variable if available
  if (import.meta.env.VITE_WS_URL) {
    return import.meta.env.VITE_WS_URL;
  }
  
  // In production with no env var, derive from current window location
  if (isProduction && typeof window !== "undefined") {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${protocol}//${window.location.host}`;
  }
  
  // Default fallback for development
  return "ws://localhost:5000";
}

const WS_URL = getWebsocketUrl();

// Make sure this type definition matches exactly with the one in ProductList.tsx
type Service = "blinkit" | "zepto" | "instamart"

interface Product {
  id: string
  name: string
  price: string
  originalPrice: string | null
  savings: string | null
  quantity: string
  deliveryTime: string
  discount: string | null
  imageUrl: string
  available: boolean
  source?: Service  // Changed from string to Service
}

interface CartItem {
  name: string
  price: string
  quantity: string
  source?: Service  // Changed from string to Service
}

interface CartData {
  items: CartItem[]
  total: string
}

// Define service types
type ServiceStatus = "pending" | "loading" | "success" | "error" | "empty"

// Define service-specific state
interface ServiceState {
  status: ServiceStatus
  message: string
  products: Product[]
  isLoading: boolean
  logo: string
  color: string
}

export default function Home() {
  const [isConnected, setIsConnected] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [isLoadingLocation, setIsLoadingLocation] = useState(false)
  const [isLoadingSearch, setIsLoadingSearch] = useState(false)
  const [isLocationSet, setIsLocationSet] = useState(false)
  const [currentLocation, setCurrentLocation] = useState<string | null>(null)
  const [loadingMessage, setLoadingMessage] = useState("")
  
  // Service-specific states
  const [services, setServices] = useState<Record<Service, ServiceState>>({
    blinkit: {
      status: "pending",
      message: "Ready",
      products: [],
      isLoading: false,
      logo: "/src/assets/blinkit.png",
      color: "green"
    },
    zepto: {
      status: "pending",
      message: "Ready",
      products: [],
      isLoading: false,
      logo: "/src/assets/zepto.png",
      color: "purple" 
    },
    instamart: {
      status: "pending",
      message: "Ready",
      products: [],
      isLoading: false,
      logo: "/src/assets/instamart.png",
      color: "orange"
    }
  })
  
  const [activeService, setActiveService] = useState<Service | null>(null)
  const [cartData, setCartData] = useState<CartData>({ items: [], total: "₹0" })
  const [showCart, setShowCart] = useState(false)
  const [cartCount, setCartCount] = useState(0)
  const [error, setError] = useState("")

  const ws = useRef<WebSocket | null>(null)

  useEffect(() => {
    const initializeWebSocket = () => {
      try {
        ws.current = new WebSocket(WS_URL)

        ws.current.onopen = () => {
          console.log("WebSocket Connected")
          setIsConnected(true)
          setError("")
          toast.success("Connected to server!", {
            icon: "🚀",
            style: {
              background: '#22c55e',
              color: 'white',
            }
          })

          ws.current?.send(
            JSON.stringify({
              action: "initialize",
              debug: false,
            }),
          )

          setIsLoading(true)
          setLoadingMessage("Initializing browsers...")
        }

        ws.current.onclose = (event) => {
          console.log("WebSocket Disconnected", event)
          setIsConnected(false)

          if (!event.wasClean) {
            toast.error("Connection lost. Reconnecting...", {
              icon: "🔌",
              style: {
                background: '#ef4444',
                color: 'white',
              }
            })
            setTimeout(() => {
              if (ws.current?.readyState === WebSocket.CLOSED) {
                console.log("Attempting to reconnect...")
                initializeWebSocket()
              }
            }, 3000)
          }
        }

        ws.current.onerror = (error) => {
          console.error("WebSocket Error:", error)
          setIsConnected(false)
          setError(
            "Connection error. Server might be unavailable.",
          )
          toast.error("Connection error. Please try again.", {
            icon: "❌",
            style: {
              background: '#ef4444',
              color: 'white',
            }
          })
          setIsLoading(false)
        }

        ws.current.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data)
            console.log("Received message:", data)

            if (data.action === "statusUpdate") {
              if (data.message) {
                setLoadingMessage(data.message)
              }

              if (data.step === "initialize") {
                if (data.status === "completed" && data.success) {
                  setIsLoading(false)
                  setLoadingMessage("")
                  toast.success(data.message || "Browsers initialized.", {
                    icon: "👍",
                     style: {
                        background: '#10b981',
                        color: 'white',
                      }
                  })
                } else if (data.status === "error") {
                  setError(data.message || "Failed to initialize browsers.")
                  toast.error(data.message || "Browser init failed.", { icon: "🙁" })
                  setIsLoading(false)
                  setLoadingMessage("")
                }
              } else if (data.step === "setLocation") {
                setIsLoadingLocation(data.status === "loading")
                if (data.status === "completed") {
                  if (data.success) {
                    setIsLocationSet(true)
                    // Show location status for services
                    if (data.locationResults) {
                      const locationMessages = data.locationResults
                        .map((r: any) => `${r.service}: ${r.success ? '✅' : '❌'}`)
                        .join(', ')
                      setCurrentLocation(`${locationMessages}`)
                      toast.success(`Location set! ${locationMessages}`, {
                        icon: "📍",
                        style: {
                          background: '#10b981',
                          color: 'white',
                        }
                      })
                    } else {
                      setCurrentLocation("Set on one or more services")
                      toast.success(data.message || "Location set!", {
                        icon: "📍",
                        style: {
                          background: '#10b981',
                          color: 'white',
                        }
                      })
                    }
                  } else {
                    setIsLocationSet(false)
                    setCurrentLocation(null)
                    toast.error(data.message || "Failed to set location.", { icon: "🗺️❌" })
                  }
                } else if (data.status === "error") {
                  setIsLocationSet(false)
                  setCurrentLocation(null)
                  toast.error(data.message || "Error setting location.", { icon: "🗺️🔥" })
                }
              } else if (data.step === "search") {
                setIsLoadingSearch(data.status === "loading")
                if (data.status === "completed") {
                  // Search completed
                  setIsLoadingSearch(false)
                  setLoadingMessage("")
                } else if (data.status === "error") {
                  setError(data.message || `Search error`)
                  setIsLoadingSearch(false)
                  setLoadingMessage("")
                  toast.error(data.message || "Search error", { icon: "🔍❌" })
                }
              }
              return
            }
              // Handle service-specific search updates
            if (data.action === "serviceSearchUpdate") {
              const { service, status, message } = data
              
              if (service && ["blinkit", "zepto", "instamart"].includes(service)) {
                setServices(prev => ({
                  ...prev,
                  [service]: {
                    ...prev[service as Service],
                    status: status as ServiceStatus,
                    message: message || prev[service as Service].message,
                    isLoading: status === "loading" || status === "navigating" || status === "extracting"
                  }
                }))
                
                // Show subtle toasts for service status updates
                if (status === "error") {
                  toast.error(`${service}: ${message}`, { 
                    duration: 2000,
                    style: { background: '#fee2e2' }
                  })
                }
              }
              return
            }

            if (data.status === "error") {
              setError(data.message || `Error: ${data.action || 'unknown'}`)
              toast.error(data.message || `Error: ${data.action || 'operation'}`, { icon: "🔥" })
              setIsLoading(false)
              setIsLoadingLocation(false)
              setIsLoadingSearch(false)
              setLoadingMessage("")
              return
            }

            switch (data.action) {
              case "searchResults":
                // Reset search loading states
                setIsLoadingSearch(false)
                setLoadingMessage("")
                
                if (data.products) {
                  // Update products for all services
                  setServices(prev => ({
                    blinkit: {
                      ...prev.blinkit,
                      products: data.products.blinkit || [],
                      status: data.products.blinkit?.length > 0 ? "success" : "empty",
                      isLoading: false,
                      message: data.products.blinkit?.length > 0 
                        ? `Found ${data.products.blinkit.length} products` 
                        : "No products found"
                    },
                    zepto: {
                      ...prev.zepto,
                      products: data.products.zepto || [],
                      status: data.products.zepto?.length > 0 ? "success" : "empty",
                      isLoading: false,
                      message: data.products.zepto?.length > 0 
                        ? `Found ${data.products.zepto.length} products` 
                        : "No products found"
                    },
                    instamart: {
                      ...prev.instamart,
                      products: data.products.instamart || [],
                      status: data.products.instamart?.length > 0 ? "success" : "empty",
                      isLoading: false,
                      message: data.products.instamart?.length > 0 
                        ? `Found ${data.products.instamart.length} products` 
                        : "No products found"
                    }
                  }))
                  
                  const totalCount = data.productCount?.total || 0
                  
                  if (totalCount > 0) {
                    toast.success(`Found ${totalCount} products across all services!`, {
                      icon: "🛍️",
                      style: {
                          background: '#3b82f6',
                          color: 'white',
                        }
                    })
                  } else {
                    toast("No products found on any service.", {
                      icon: '🤔',
                      style: {
                        background: '#fef3c7',
                        color: '#92400e'
                      }
                    })
                  }
                }
                break

              case "addToCart":
                setCartCount((prev) => prev + 1)
                toast.success(data.message || `Product added to ${data.service || ""} cart!`, {
                  icon: "🛒✅",
                   style: {
                        background: '#16a34a',
                        color: 'white',
                      }
                })
                break

              case "removeFromCart": 
                setCartCount((prev) => Math.max(0, prev - 1))
                toast.success(data.message || "Product removed.", {
                  icon: "🛒➖",
                  style: {
                        background: '#f97316',
                        color: 'white',
                      }
                })
                break

              case "viewCart":
                if (data.cart) {
                  setCartData(data.cart)
                  setShowCart(true)
                  setCartCount(data.cart.items?.length || 0)
                  toast.success(data.message || "Cart loaded.")
                } else {
                  toast("Cart data missing in successful response.", {
                    icon: '⚠️',
                    style: {
                      background: '#FEF3C7',
                      color: '#92400E'
                    }
                  })
                }
                setIsLoading(false)
                setLoadingMessage("")
                break

              default:
                console.warn("Received unhandled successful action:", data.action, data)
                break
            }
          } catch (parseError) {
            console.error("Error parsing WebSocket message:", parseError)
            setError("Error processing server response.")
            toast.error("Error processing server response.", { icon: "🤯" })
            setIsLoading(false)
            setLoadingMessage("")
          }
        }
      } catch (error) {
        console.error("Error creating WebSocket connection:", error)
        setError("Failed to establish connection. Please refresh the page or try again later.")
        toast.error("Failed to establish connection")
        setIsConnected(false)
        setIsLoading(false)
      }
    }

    initializeWebSocket()

    return () => {
      if (ws.current) {
        const socket = ws.current
        socket.onclose = null
        socket.close()
        ws.current = null
      }
    }
  }, [])

  const handleSetLocation = (location: string) => {
    if (!ws.current || ws.current.readyState !== WebSocket.OPEN) {
      toast.error("Connection not ready. Please wait.")
      return
    }
    try {
      setIsLoadingLocation(true)
      setCurrentLocation(null)
      setLoadingMessage(`Setting location to ${location} on all services...`)
      ws.current.send(
        JSON.stringify({
          action: "setLocation",
          location,
        }),
      )
    } catch (error) {
      console.error("Error sending setLocation request:", error)
      toast.error("Failed to send setLocation request.")
      setIsLoadingLocation(false)
    }
  }

  const handleSearch = (searchTerm: string) => {
    if (!ws.current || ws.current.readyState !== WebSocket.OPEN) {
      toast.error("Connection not ready. Please wait.")
      return
    }
    if (!isLocationSet) {
      toast.error("Please set the location before searching.")
      return
    }

    try {
      // Reset all services to loading state
      setServices(prev => ({
        blinkit: { ...prev.blinkit, status: "loading", isLoading: true, message: "Searching..." },
        zepto: { ...prev.zepto, status: "loading", isLoading: true, message: "Searching..." },
        instamart: { ...prev.instamart, status: "loading", isLoading: true, message: "Searching..." }
      }))
      
      setIsLoadingSearch(true)
      setLoadingMessage(`Searching for ${searchTerm} across all services...`)
      setShowCart(false)

      ws.current.send(
        JSON.stringify({
          action: "search",
          searchTerm,
        }),
      )
    } catch (error) {
      console.error("Error sending search request:", error)
      toast.error("Failed to send search request.")
      setIsLoadingSearch(false)
    }
  }

  const handleAddToCart = (productId: string, service: Service) => {
    if (!ws.current || ws.current.readyState !== WebSocket.OPEN) {
      setError("Connection lost. Please refresh the page.")
      toast.error("Connection lost")
      return
    }

    ws.current.send(
      JSON.stringify({
        action: "addToCart",
        productId,
        service
      }),
    )
  }

  const handleRemoveFromCart = (productId: string) => {
    if (!ws.current || ws.current.readyState !== WebSocket.OPEN) {
      setError("Connection lost. Please refresh the page.")
      toast.error("Connection lost")
      return
    }

    ws.current.send(
      JSON.stringify({
        action: "removeFromCart",
        productIdToRemove: productId,
      }),
    )
    
    setIsLoading(true)
    setLoadingMessage("Loading cart...")

    ws.current.send(
      JSON.stringify({
        action: "viewCart",
      }),
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Toaster position="top-center" reverseOrder={false} />
      <header className="bg-orange-500 text-white shadow-md sticky top-0 z-50">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between h-16">
          <div className="flex items-center">
            <Package2 className="h-8 w-8 mr-2 text-white" />
            <h1 className="text-xl sm:text-2xl font-bold">QuickCom Scraper</h1>
          </div>
          <div className="flex items-center space-x-4">
            {isLocationSet && currentLocation && (
              <div className="hidden sm:flex items-center mr-4 p-2 bg-orange-400 rounded-md">
                <MapPin className="h-4 w-4 mr-1.5" />
                <span className="text-xs font-medium">{currentLocation}</span>
              </div>
            )}
            <Button 
              variant="ghost" 
              size="icon" 
              className="relative hover:bg-orange-400 focus:bg-orange-400"
              onClick={() => setShowCart(true)}
              aria-label="View Cart"
            >
              <ShoppingCart className="h-6 w-6" />
              {cartCount > 0 && (
                <Badge className="absolute -top-1 -right-1 bg-yellow-400 text-slate-900 px-1.5 py-0.5 text-xs font-bold">
                  {cartCount}
                </Badge>
              )}
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto p-4 sm:p-6 lg:p-8 flex-grow">
        {error && (
          <div className="mb-4 p-3 bg-red-100 border border-red-200 text-red-700 rounded-md flex items-center">
            <AlertCircle className="h-5 w-5 mr-2 text-red-500" />
            <span>{error}</span>
          </div>
        )}
        <SearchForm 
          onSetLocation={handleSetLocation} 
          onSearch={handleSearch} 
          disabled={!isConnected || isLoading}
          isLoadingLocation={isLoadingLocation}
          isLoadingSearch={isLoadingSearch}
          isLocationSet={isLocationSet}
          currentLocation={currentLocation}
        />
        {(isLoading || isLoadingSearch) && loadingMessage && (
          <LoadingIndicator message={loadingMessage} />
        )}

        {/* Service tabs */}
        <div className="mb-6 border-b border-gray-200">
          <ul className="flex flex-wrap -mb-px text-sm font-medium text-center">
            <li className="mr-2">
              <button 
                className={`inline-block p-4 rounded-t-lg ${activeService === null ? 'border-b-2 border-yellow-500 text-yellow-600 font-semibold' : 'hover:text-gray-600 hover:border-gray-300'}`}
                onClick={() => setActiveService(null)}
              >
                All Services
              </button>
            </li>
            {Object.entries(services).map(([service, data]) => (
              <li className="mr-2" key={service}>
                <button
                  className={`inline-block p-4 rounded-t-lg ${activeService === service ? `border-b-2 border-${data.color}-500 text-${data.color}-600 font-semibold` : 'hover:text-gray-600 hover:border-gray-300'}`}
                  onClick={() => setActiveService(service as Service)}
                >
                  {service.charAt(0).toUpperCase() + service.slice(1)}
                  {data.isLoading && (
                    <span className="ml-2 inline-block w-4 h-4 border-2 border-t-transparent border-green-500 rounded-full animate-spin"></span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        </div>

        {/* Conditional rendering based on active service */}
        {activeService === null ? (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {Object.entries(services).map(([service, data]) => (
              <div key={service} className="mb-6">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-lg font-bold capitalize flex items-center">
                    <img src={data.logo} alt={`${service} logo`} className="h-6 w-auto mr-2" />
                    {service}
                    {data.isLoading && (
                      <span className="ml-2 inline-block w-4 h-4 border-2 border-t-transparent border-green-500 rounded-full animate-spin"></span>
                    )}
                  </h2>
                  <span className={`text-sm px-2 py-1 rounded ${data.status === 'success' ? 'bg-green-100 text-green-800' : 
                    data.status === 'error' ? 'bg-red-100 text-red-800' : 
                    data.status === 'empty' ? 'bg-gray-100 text-gray-800' : 
                    'bg-blue-100 text-blue-800'}`}>
                    {data.products.length} items
                  </span>
                </div>
                <ProductList 
                  products={data.products} 
                  onAddToCart={(productId) => handleAddToCart(productId, service as Service)}
                  isCompact={true}
                  serviceName={service as Service}
                  isLoading={data.isLoading}
                />
              </div>
            ))}
          </div>
        ) : (
          <div>
            <ProductList 
              products={services[activeService].products} 
              onAddToCart={(productId) => handleAddToCart(productId, activeService)}
              serviceName={activeService}
              isLoading={services[activeService].isLoading}
            />
          </div>
        )}
      </main>
      
      {showCart && <Cart cartData={cartData} onClose={() => setShowCart(false)} onRemoveFromCart={handleRemoveFromCart} />}

      <footer className="bg-slate-800 text-white text-center p-4 mt-auto">
        <p>&copy; {new Date().getFullYear()} QuickCom Scraper Tool. For educational purposes only.</p>
      </footer>
    </div>
  )
}

"use client"

import { useState } from "react"
import { Card, CardFooter, CardHeader } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ShoppingCart, Check, ImageOff, Search, Tag, Clock } from "lucide-react"

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
  source?: Service
}

interface ProductListProps {
  products: Product[]
  onAddToCart: (productId: string) => void
  isCompact?: boolean
  serviceName?: Service
  isLoading?: boolean
}

export function ProductList({ 
  products, 
  onAddToCart, 
  isCompact = false,
  serviceName,
  isLoading = false
}: ProductListProps) {
  const [addedItems, setAddedItems] = useState<Record<string, boolean>>({})

  const handleAddToCart = (productId: string) => {
    onAddToCart(productId)
    setAddedItems((prev) => ({ ...prev, [productId]: true }))
    setTimeout(() => {
      setAddedItems((prev) => ({ ...prev, [productId]: false }))
    }, 1500)
  }

  // Define colors based on service
  const serviceColors = {
    blinkit: {
      badge: "bg-green-600",
      button: "bg-green-500 hover:bg-green-600",
      price: "text-green-600"
    },
    zepto: {
      badge: "bg-purple-600",
      button: "bg-purple-500 hover:bg-purple-600",
      price: "text-purple-600"
    },
    instamart: {
      badge: "bg-orange-600",
      button: "bg-orange-500 hover:bg-orange-600", 
      price: "text-orange-600"
    }
  }

  // Get the correct color scheme
  const getServiceColor = (product: Product) => {
    const service = product.source || serviceName || "blinkit"
    return serviceColors[service as Service] || serviceColors.blinkit
  }

  if (isLoading) {
    return (
      <div className="flex justify-center items-center p-12 text-gray-500">
        <div className="flex flex-col items-center">
          <div className="w-12 h-12 border-4 border-t-transparent border-yellow-500 rounded-full animate-spin mb-4"></div>
          <p>Loading products...</p>
        </div>
      </div>
    )
  }

  if (products.length === 0) {
    return (
      <div className="flex justify-center items-center p-12 bg-gray-50 rounded-lg border border-gray-200 text-gray-500">
        <div className="flex flex-col items-center">
          <Search className="w-12 h-12 text-gray-400 mb-2" />
          <h3 className="text-lg font-medium mb-1">No Products Found</h3>
          <p className="text-sm text-center">Try a different search term or check a different service.</p>
        </div>
      </div>
    )
  }

  // Determine the grid columns based on compact mode
  const gridClass = isCompact
    ? "grid grid-cols-1 sm:grid-cols-2 gap-3"
    : "grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6"

  return (
    <div className={gridClass}>
      {products.map((product) => {
        const serviceColor = getServiceColor(product)
        
        return (
        <Card 
          key={product.id} 
          className={`overflow-hidden flex flex-col h-full group relative border-slate-200 shadow-lg hover:shadow-xl transition-shadow duration-300 rounded-lg ${isCompact ? "compact" : ""}`}
        >
          {product.discount && (
            <Badge className={`absolute top-2 left-2 z-10 ${serviceColor.badge} text-white px-2 py-1 text-xs font-semibold`}>
              <Tag className="h-3 w-3 mr-1" /> {product.discount}
            </Badge>
          )}
          {!product.available && (
            <Badge variant="destructive" className="absolute top-2 right-2 z-10 bg-slate-700 text-white px-2 py-1 text-xs font-semibold">
              Out of Stock
            </Badge>
          )}
          <CardHeader className="p-3 pb-0">
            <div className="relative">
              {product.imageUrl ? (
                <>
                  <img 
                    src={product.imageUrl} 
                    alt={product.name} 
                    className={`w-full ${isCompact ? 'h-24' : 'h-32 sm:h-40'} object-contain mb-2 sm:mb-3 group-hover:opacity-80 transition-opacity duration-300`} 
                  />                  <img 
                    src={serviceColors[(product.source || serviceName || 'blinkit') as Service] 
                      ? `/src/assets/${product.source || serviceName || 'blinkit'}.png` 
                      : '/src/assets/blinkit.png'}
                    alt={`${product.source || serviceName || 'Service'} Logo`} 
                    className="absolute top-2 right-2 h-5 w-auto opacity-50 group-hover:opacity-100 transition-opacity duration-300"
                  />
                </>
              ) : (
                <div className={`flex items-center justify-center ${isCompact ? 'h-24' : 'h-32 sm:h-40'} bg-slate-100 rounded-lg mb-2 sm:mb-3`}>
                  <ImageOff className="h-10 w-10 text-slate-400" />
                </div>
              )}
            </div>
            <h3 className={`text-sm ${isCompact ? '' : 'sm:text-base'} font-semibold mb-1 group-hover:text-orange-600 transition-colors duration-300 truncate`} title={product.name}>
              {product.name}
            </h3>
            <p className="text-xs sm:text-sm text-gray-600 mb-1">{product.quantity}</p>
            
            {product.deliveryTime && (
              <div className="flex items-center text-xs text-green-700 mb-1.5">
                <Clock className="h-3 w-3 mr-1" />
                <span>{product.deliveryTime}</span>
              </div>
            )}
            
            <div className="mt-auto">
              <div className="flex items-baseline gap-2">
                <span className={`font-semibold ${serviceColor.price} ${isCompact ? 'text-sm' : 'text-base'}`}>{product.price}</span>
                {product.originalPrice && (
                  <span className="text-gray-400 line-through text-xs">
                    {product.originalPrice}
                  </span>
                )}
              </div>
              {product.savings && (
                <p className="text-xs text-green-600 font-medium">
                  Save {product.savings}
                </p>
              )}
            </div>
          </CardHeader>
          
          <CardFooter className={`p-3 pt-2 mt-auto ${isCompact ? 'pb-3' : ''}`}>
            <Button
              onClick={() => product.available ? handleAddToCart(product.id) : null}
              disabled={!product.available || addedItems[product.id]}
              className={`w-full py-1.5 rounded-md text-sm font-medium text-white transition-all duration-200 ${
                addedItems[product.id]
                  ? "bg-green-600 hover:bg-green-700"
                  : product.available
                  ? serviceColor.button
                  : "bg-slate-300 cursor-not-allowed"
              }`}
            >
              {addedItems[product.id] ? (
                <>
                  <Check className="h-4 w-4 mr-1" aria-hidden="true" /> Added
                </>
              ) : product.available ? (
                <>
                  <ShoppingCart className="h-4 w-4 mr-1" aria-hidden="true" /> Add
                </>
              ) : (
                "Out of Stock"
              )}
            </Button>
          </CardFooter>
        </Card>
      )})}
    </div>
  )
}

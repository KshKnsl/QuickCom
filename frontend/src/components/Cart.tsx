"use client"

import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ShoppingCart, ArrowLeft, CreditCard, Lock, Hash } from "lucide-react"

interface CartItem {
  name: string
  price: string
  quantity: string
}

interface CartData {
  items: CartItem[]
  total: string
}

interface CartProps {
  cartData: CartData
  onClose: () => void
  onCheckout?: () => void
  onRemoveFromCart?: (productId: string) => void
}

export function Cart({ cartData, onClose, onCheckout }: CartProps) {
  return (
    <Card className="border-gray-100">
      <CardHeader className="flex flex-row items-center justify-between pb-4 border-b">
        <CardTitle className="flex items-center gap-2">
          <ShoppingCart className="h-5 w-5 text-emerald-500" />
          Your Cart
        </CardTitle>
        <Button
          onClick={onClose}
          variant="ghost"
          className="text-muted-foreground hover:text-foreground flex items-center gap-1"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Products
        </Button>
      </CardHeader>

      <CardContent className="pt-6">
        {cartData.items.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-24 h-24 rounded-full bg-gray-50 flex items-center justify-center mx-auto mb-4">
              <ShoppingCart className="h-12 w-12 text-gray-300" />
            </div>
            <h3 className="text-xl font-semibold text-gray-700 mb-2">Your cart is empty</h3>
            <p className="text-muted-foreground">Looks like you haven't added any items yet.</p>
          </div>
        ) : (
          <div className="overflow-y-auto max-h-96 pr-2">
            <div className="divide-y divide-gray-100">
              {cartData.items.map((item, index) => (
                <div
                  key={index}
                  className="py-4 flex justify-between items-center hover:bg-gray-50 px-2 rounded transition-colors"
                >
                  <div className="flex-grow">
                    <h3 className="font-medium text-gray-800 line-clamp-1">{item.name}</h3>
                    <Badge variant="outline" className="mt-1">
                      <Hash className="h-3 w-3 mr-1" />
                      Qty: {item.quantity}
                    </Badge>
                  </div>
                  <div className="font-semibold text-gray-800 ml-4">{item.price}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>

      {cartData.items.length > 0 && (
        <CardFooter className="flex flex-col pt-6 border-t">
          <div className="flex justify-between items-center bg-gray-50 p-4 rounded-lg mb-6 w-full">
            <span className="font-bold text-lg">Order Total:</span>
            <span className="font-bold text-xl text-emerald-600">{cartData.total}</span>
          </div>

          <div className="flex flex-col space-y-3 w-full">
            <Button onClick={onCheckout} className="w-full bg-emerald-500 hover:bg-emerald-600">
              <CreditCard className="h-5 w-5 mr-2" />
              Proceed to Checkout
            </Button>
            <Button onClick={onClose} variant="outline" className="w-full">
              Continue Shopping
            </Button>
          </div>

          <div className="flex items-center justify-center mt-5 text-sm text-muted-foreground">
            <Lock className="h-4 w-4 mr-1 text-emerald-500" />
            Secure Checkout
          </div>
        </CardFooter>
      )}
    </Card>
  )
}

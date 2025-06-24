import { Card, CardContent } from "@/components/ui/card"
import { Loader2 } from "lucide-react"

interface LoadingIndicatorProps {
  message?: string
}

export function LoadingIndicator({ message }: LoadingIndicatorProps) {
  return (
    <Card className="mb-6">
      <CardContent className="p-6 flex items-center justify-center">
        <div className="flex flex-col items-center">
          <Loader2 className="h-8 w-8 text-emerald-500 animate-spin mb-2" />
          <p className="text-lg font-medium text-gray-700">{message || "Loading..."}</p>
        </div>
      </CardContent>
    </Card>
  )
}

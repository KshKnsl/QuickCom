"use client"

import type React from "react"
import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Search, MapPin, Loader2, AlertCircle, CheckCircle2 } from "lucide-react"

interface SearchFormProps {
  onSetLocation: (location: string) => void
  onSearch: (searchTerm: string) => void
  disabled: boolean
  isLoadingLocation: boolean
  isLoadingSearch: boolean
  isLocationSet: boolean
  currentLocation: string | null 
}

export function SearchForm({
  onSetLocation,
  onSearch,
  disabled,
  isLoadingLocation,
  isLoadingSearch,
  isLocationSet,
  currentLocation, 
}: SearchFormProps) {
  const [locationInput, setLocationInput] = useState("")
  const [searchInput, setSearchInput] = useState("")

  const handleSetLocationSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (locationInput) {
      onSetLocation(locationInput)
    }
  }

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (searchInput) {
      onSearch(searchInput)
    }
  }

  return (
    <Card className="mb-6 shadow-md">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg sm:text-xl text-slate-700">
          <MapPin className="h-5 w-5 text-green-500" /> 
          Set Location & Search
        </CardTitle>
      </CardHeader>
      <CardContent>
        {disabled && !isLocationSet && (
          <div className="mb-4 p-3 bg-yellow-100 border border-yellow-200 rounded-md text-yellow-700 text-sm">
            <p className="flex items-center">
              <AlertCircle className="h-4 w-4 mr-2 text-yellow-600" />
              Waiting for connection to server. Controls will be available once connected.
            </p>
          </div>
        )}

        <form onSubmit={handleSetLocationSubmit} className="space-y-4 mb-6">
          <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-end">
            <div className="flex-1">
              <Label htmlFor="location" className="mb-1.5 block text-sm font-medium text-slate-600">
                Location
              </Label>
              <div className="relative">
                <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  id="location"
                  placeholder="e.g., Sector 62 Noida"
                  className="pl-10 h-10 text-sm sm:text-base border-slate-300 focus:border-green-500 focus:ring-green-500"
                  value={locationInput}
                  onChange={(e) => setLocationInput(e.target.value)}
                  disabled={disabled || isLoadingLocation || isLocationSet}
                />
              </div>
              {isLocationSet && currentLocation && (
                <p className="mt-1.5 text-xs text-green-700 font-semibold flex items-center">
                  <CheckCircle2 className="h-3 w-3 mr-1" /> Location set to: <strong>{currentLocation}</strong>.
                </p>
              )}
            </div>
            <Button
              type="submit"
              className={`w-full sm:w-auto h-10 text-sm sm:text-base ${isLocationSet ? "bg-slate-300 hover:bg-slate-300 cursor-not-allowed" : "bg-green-500 hover:bg-green-600 text-white"}`}
              disabled={disabled || isLoadingLocation || !locationInput || isLocationSet}
            >
              {isLoadingLocation ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Setting...
                </span>
              ) : isLocationSet ? (
                <span className="flex items-center justify-center gap-2 text-slate-600">
                  <CheckCircle2 className="h-4 w-4" />
                  Set
                </span>
              ) : (
                "Set Location"
              )}
            </Button>
          </div>
        </form>

        <form onSubmit={handleSearchSubmit} className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-end">
            <div className="flex-1">
              <Label htmlFor="searchTerm" className="mb-1.5 block text-sm font-medium text-slate-600">
                Search Term
              </Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  id="searchTerm"
                  placeholder="e.g., milk, bread, vegetables"
                  className="pl-10 h-10 text-sm sm:text-base border-slate-300 focus:border-orange-500 focus:ring-orange-500"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  disabled={disabled || isLoadingSearch || !isLocationSet}
                />
              </div>
              {!isLocationSet && (
                 <p className="mt-1.5 text-xs text-red-600">Please set location before searching.</p> // Changed color for emphasis
              )}
              {isLocationSet && currentLocation && (
                 <p className="mt-1.5 text-xs text-slate-500">Searching in: <strong>{currentLocation}</strong></p>
              )}
            </div>
            <Button
              type="submit"
              className="w-full sm:w-auto h-10 text-sm sm:text-base bg-orange-500 hover:bg-orange-600 text-white disabled:bg-slate-300"
              disabled={disabled || isLoadingSearch || !searchInput || !isLocationSet}
            >
              {isLoadingSearch ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Searching...
                </span>
              ) : (
                <span className="flex items-center justify-center gap-1">
                  <Search className="h-4 w-4"/> Search Products
                </span>
              )}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}

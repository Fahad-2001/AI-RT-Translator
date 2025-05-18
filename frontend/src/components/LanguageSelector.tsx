"use client"

import { ChevronDown } from "lucide-react"
import { cn } from "../utils/cn"

const LanguageSelector = ({
  value,
  onChange,
  label,
  options,
}: {
  value: string
  onChange: (value: string) => void
  label: string
  options: { value: string; label: string }[]
}) => {
  const selectedLanguage = options.find((option) => option.value === value)?.label || value

  return (
    <div className="relative">
      {label && <label className="block text-sm font-medium text-gray-500 mb-1">{label}</label>}
      <div className="relative">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={cn(
            "w-full appearance-none bg-transparent text-base font-medium text-gray-800 py-1 pl-1 pr-8 focus:outline-none",
            !label && "font-semibold text-blue-600",
          )}
        >
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-1 text-gray-500">
          <ChevronDown className="h-4 w-4" />
        </div>
      </div>
    </div>
  )
}

export default LanguageSelector

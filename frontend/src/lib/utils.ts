import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatEmailDate(date: string) {
  const emailDate = new Date(date)
  const now = new Date()
  const diffTime = Math.abs(now.getTime() - emailDate.getTime())
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))

  if (diffDays === 1) {
    return emailDate.toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      minute: '2-digit',
      hour12: true 
    })
  } else if (diffDays < 7) {
    return emailDate.toLocaleDateString('en-US', { weekday: 'short' })
  } else if (emailDate.getFullYear() === now.getFullYear()) {
    return emailDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  } else {
    return emailDate.toLocaleDateString('en-US', { year: '2-digit', month: 'short', day: 'numeric' })
  }
}

export function truncateText(text: string, maxLength: number) {
  if (text.length <= maxLength) return text
  return text.substring(0, maxLength) + '...'
}

export function getInitials(name: string) {
  return name
    .split(' ')
    .map(word => word[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
} 
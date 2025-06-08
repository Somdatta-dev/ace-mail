import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatEmailDate(date: string | Date) {
  const emailDate = new Date(date)
  const now = new Date()
  const diffTime = now.getTime() - emailDate.getTime()
  const diffMinutes = Math.floor(diffTime / (1000 * 60))
  const diffHours = Math.floor(diffTime / (1000 * 60 * 60))
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24))

  // Format the full date and time
  const fullDate = emailDate.toLocaleDateString('en-US', { 
    weekday: 'short', 
    year: 'numeric', 
    month: 'short', 
    day: 'numeric' 
  })
  const fullTime = emailDate.toLocaleTimeString('en-US', { 
    hour: 'numeric', 
    minute: '2-digit',
    hour12: true 
  })

  // Generate relative time
  let relativeTime = ''
  if (diffMinutes < 1) {
    relativeTime = 'just now'
  } else if (diffMinutes < 60) {
    relativeTime = diffMinutes === 1 ? '1 minute ago' : `${diffMinutes} minutes ago`
  } else if (diffHours < 24) {
    relativeTime = diffHours === 1 ? '1 hour ago' : `${diffHours} hours ago`
  } else if (diffDays === 1) {
    relativeTime = 'yesterday'
  } else if (diffDays < 7) {
    relativeTime = `${diffDays} days ago`
  } else if (diffDays < 30) {
    const weeks = Math.floor(diffDays / 7)
    relativeTime = weeks === 1 ? '1 week ago' : `${weeks} weeks ago`
  } else if (diffDays < 365) {
    const months = Math.floor(diffDays / 30)
    relativeTime = months === 1 ? '1 month ago' : `${months} months ago`
  } else {
    const years = Math.floor(diffDays / 365)
    relativeTime = years === 1 ? '1 year ago' : `${years} years ago`
  }

  // Return combined format for email list (shorter)
  if (diffMinutes < 60) {
    return relativeTime
  } else if (diffHours < 24) {
    return `${fullTime} (${relativeTime})`
  } else if (diffDays < 7) {
    return `${fullDate}, ${fullTime} (${relativeTime})`
  } else {
    return `${fullDate}, ${fullTime}`
  }
}

// Extended format for email details view
export function formatEmailDateDetailed(date: string | Date) {
  const emailDate = new Date(date)
  const now = new Date()
  const diffTime = now.getTime() - emailDate.getTime()
  const diffMinutes = Math.floor(diffTime / (1000 * 60))
  const diffHours = Math.floor(diffTime / (1000 * 60 * 60))
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24))

  // Format the full date and time
  const fullDate = emailDate.toLocaleDateString('en-US', { 
    weekday: 'short', 
    year: 'numeric', 
    month: 'short', 
    day: 'numeric' 
  })
  const fullTime = emailDate.toLocaleTimeString('en-US', { 
    hour: 'numeric', 
    minute: '2-digit',
    hour12: true 
  })

  // Generate relative time
  let relativeTime = ''
  if (diffMinutes < 1) {
    relativeTime = 'just now'
  } else if (diffMinutes < 60) {
    relativeTime = diffMinutes === 1 ? '1 minute ago' : `${diffMinutes} minutes ago`
  } else if (diffHours < 24) {
    relativeTime = diffHours === 1 ? '1 hour ago' : `${diffHours} hours ago`
  } else if (diffDays === 1) {
    relativeTime = 'yesterday'
  } else if (diffDays < 7) {
    relativeTime = `${diffDays} days ago`
  } else if (diffDays < 30) {
    const weeks = Math.floor(diffDays / 7)
    relativeTime = weeks === 1 ? '1 week ago' : `${weeks} weeks ago`
  } else if (diffDays < 365) {
    const months = Math.floor(diffDays / 30)
    relativeTime = months === 1 ? '1 month ago' : `${months} months ago`
  } else {
    const years = Math.floor(diffDays / 365)
    relativeTime = years === 1 ? '1 year ago' : `${years} years ago`
  }

  // Return detailed format: "Sat, Jun 7, 7:04 PM (19 hours ago)"
  return `${fullDate}, ${fullTime} (${relativeTime})`
}

export function truncateText(text: string, maxLength: number) {
  if (text.length <= maxLength) return text
  return text.substring(0, maxLength) + '...'
}

export function getInitials(name: string) {
  return name
    .split(' ')
    .map(word => word.charAt(0))
    .join('')
    .toUpperCase()
    .slice(0, 2)
} 
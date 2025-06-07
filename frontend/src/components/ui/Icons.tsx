import {
  Mail,
  Search,
  Settings,
  Menu,
  X,
  Star,
  Archive,
  Trash2,
  Send,
  FileText,
  AlertTriangle,
  RefreshCw,
  Sun,
  Moon,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Plus,
  Check,
  Inbox,
  PaperclipIcon,
  Reply,
  ReplyAll,
  Forward,
  MoreHorizontal,
  Circle,
  CheckCircle2,
  Edit3,
  Bot,
  Brain,
  Sparkles,
  MessageCircleQuestion,
  ListChecks,
  FileEdit,
  Wand2,
  MessageSquare,
  Calendar
} from "lucide-react"

export const Icons = {
  // Navigation
  inbox: Inbox,
  mail: Mail,
  send: Send,  // Add send for compose
  sent: Send,
  drafts: Edit3,
  fileText: FileText,  // Add fileText for compose
  archive: Archive,
  trash: Trash2,
  spam: AlertTriangle,
  
  // Actions
  search: Search,
  settings: Settings,
  menu: Menu,
  close: X,
  refresh: RefreshCw,
  plus: Plus,
  check: Check,
  
  // Email actions
  star: Star,
  reply: Reply,
  replyAll: ReplyAll,
  forward: Forward,
  attachment: PaperclipIcon,
  more: MoreHorizontal,
  
  // States
  read: CheckCircle2,
  unread: Circle,
  
  // Theme
  sun: Sun,
  moon: Moon,
  
  // Navigation
  chevronLeft: ChevronLeft,
  chevronRight: ChevronRight,
  chevronDown: ChevronDown,
  
  // AI Features
  ai: Bot,
  brain: Brain,
  sparkles: Sparkles,
  question: MessageCircleQuestion,
  actionItems: ListChecks,
  improve: Wand2,
  chat: MessageSquare,
  compose: FileEdit,
  calendar: Calendar,
}

export type IconName = keyof typeof Icons 
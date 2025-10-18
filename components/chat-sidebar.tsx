"use client"

import { Search, MoreVertical, Edit } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import type { Conversation } from "./chat-interface"
import { cn } from "@/lib/utils"

interface ChatSidebarProps {
  conversations: Conversation[]
  selectedId: string
  onSelectConversation: (conversation: Conversation) => void
}

export function ChatSidebar({ conversations, selectedId, onSelectConversation }: ChatSidebarProps) {
  return (
    <div className="flex h-full w-80 flex-col border-r border-border bg-card">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-4 py-4">
        <h1 className="text-xl font-semibold text-foreground">Messages</h1>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" className="h-9 w-9">
            <Edit className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-9 w-9">
            <MoreVertical className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Search */}
      <div className="px-4 py-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search conversations..." className="pl-9 bg-secondary border-0 focus-visible:ring-1" />
        </div>
      </div>

      {/* Conversations List */}
      <div className="flex-1 overflow-y-auto">
        {conversations.map((conversation) => (
          <button
            key={conversation.id}
            onClick={() => onSelectConversation(conversation)}
            className={cn(
              "flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-accent",
              selectedId === conversation.id && "bg-accent",
            )}
          >
            <div className="relative">
              <Avatar className="h-12 w-12">
                <AvatarImage src={conversation.avatar || "/placeholder.svg"} alt={conversation.name} />
                <AvatarFallback>{conversation.name[0]}</AvatarFallback>
              </Avatar>
              {conversation.online && (
                <div className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-card bg-green-500" />
              )}
            </div>
            <div className="flex-1 overflow-hidden">
              <div className="flex items-center justify-between gap-2">
                <h3 className="font-medium text-foreground text-sm">{conversation.name}</h3>
                <span className="text-xs text-muted-foreground whitespace-nowrap">{conversation.timestamp}</span>
              </div>
              <div className="flex items-center justify-between gap-2 mt-1">
                <p className="text-sm text-muted-foreground truncate">{conversation.lastMessage}</p>
                {conversation.unread && (
                  <Badge
                    variant="default"
                    className="h-5 min-w-5 rounded-full px-1.5 text-xs bg-primary text-primary-foreground"
                  >
                    {conversation.unread}
                  </Badge>
                )}
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}

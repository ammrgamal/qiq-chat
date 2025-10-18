"use client"

import { useState } from "react"
import { ChatSidebar } from "./chat-sidebar"
import { ChatWindow } from "./chat-window"
import { ChatInput } from "./chat-input"

export interface Message {
  id: string
  content: string
  sender: "user" | "other"
  timestamp: Date
  status?: "sent" | "delivered" | "read"
}

export interface Conversation {
  id: string
  name: string
  avatar: string
  lastMessage: string
  timestamp: string
  unread?: number
  online?: boolean
}

const mockConversations: Conversation[] = [
  {
    id: "1",
    name: "Sarah Chen",
    avatar: "/professional-woman-diverse.png",
    lastMessage: "Perfect! See you at the meeting",
    timestamp: "2m ago",
    unread: 2,
    online: true,
  },
  {
    id: "2",
    name: "Marcus Johnson",
    avatar: "/professional-man.jpg",
    lastMessage: "Thanks for the update",
    timestamp: "1h ago",
    online: true,
  },
  {
    id: "3",
    name: "Design Team",
    avatar: "/generic-team-icon.png",
    lastMessage: "New mockups are ready",
    timestamp: "3h ago",
    unread: 5,
  },
  {
    id: "4",
    name: "Elena Rodriguez",
    avatar: "/professional-woman-smiling.png",
    lastMessage: "Great work on the presentation!",
    timestamp: "Yesterday",
  },
  {
    id: "5",
    name: "Project Alpha",
    avatar: "/project-icon.png",
    lastMessage: "Deadline extended to Friday",
    timestamp: "2d ago",
  },
]

const mockMessages: Message[] = [
  {
    id: "1",
    content: "Hey! How are you doing?",
    sender: "other",
    timestamp: new Date(Date.now() - 3600000),
    status: "read",
  },
  {
    id: "2",
    content: "I'm doing great! Just finished the design mockups for the new project.",
    sender: "user",
    timestamp: new Date(Date.now() - 3500000),
    status: "read",
  },
  {
    id: "3",
    content: "That sounds amazing! Can you share them with me?",
    sender: "other",
    timestamp: new Date(Date.now() - 3400000),
    status: "read",
  },
  {
    id: "4",
    content: "Of course! I'll send them over in a few minutes. I think you'll really like the direction we took.",
    sender: "user",
    timestamp: new Date(Date.now() - 3300000),
    status: "read",
  },
  {
    id: "5",
    content: "Perfect! See you at the meeting",
    sender: "other",
    timestamp: new Date(Date.now() - 120000),
    status: "delivered",
  },
]

export function ChatInterface() {
  const [conversations] = useState<Conversation[]>(mockConversations)
  const [selectedConversation, setSelectedConversation] = useState<Conversation>(mockConversations[0])
  const [messages, setMessages] = useState<Message[]>(mockMessages)

  const handleSendMessage = (content: string) => {
    const newMessage: Message = {
      id: Date.now().toString(),
      content,
      sender: "user",
      timestamp: new Date(),
      status: "sent",
    }
    setMessages([...messages, newMessage])
  }

  return (
    <div className="flex h-full w-full bg-background">
      <ChatSidebar
        conversations={conversations}
        selectedId={selectedConversation.id}
        onSelectConversation={setSelectedConversation}
      />
      <div className="flex flex-1 flex-col">
        <ChatWindow conversation={selectedConversation} messages={messages} />
        <ChatInput onSendMessage={handleSendMessage} />
      </div>
    </div>
  )
}

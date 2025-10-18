import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { AlertTriangle } from "lucide-react"
import { ChatInterface } from "@/components/chat-interface"

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col">
      <Alert variant="destructive" className="rounded-none border-x-0 border-t-0">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Scheduled Maintenance</AlertTitle>
        <AlertDescription>
          This site will be offline for maintenance in 2 hours. We apologize for any inconvenience.
        </AlertDescription>
      </Alert>

      <main className="flex-1">
        <ChatInterface />
      </main>
    </div>
  )
}

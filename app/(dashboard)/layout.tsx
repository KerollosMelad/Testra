import React from "react"
import { Sidebar } from "@/components/layout/sidebar"
import { Toaster } from "@/components/ui/sonner"

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <main className="flex-1 overflow-auto p-6">{children}</main>
      </div>
      <Toaster />
    </div>
  )
}

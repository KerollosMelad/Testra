"use client"

import { ProjectSelector } from "./project-selector"
import { UserMenu } from "./user-menu"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Bell, Search } from "lucide-react"

export function Navbar() {
  return (
    <header className="bg-white border-b border-gray-200 px-6 py-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <ProjectSelector />
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <Input placeholder="Search projects, stories, tests..." className="pl-10 w-80" />
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm">
            <Bell className="w-4 h-4" />
          </Button>
          <UserMenu />
        </div>
      </div>
    </header>
  )
}

"use client"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Badge } from "@/components/ui/badge"
import { ChevronDown, FolderOpen, Plus } from "lucide-react"
import Link from "next/link"

const projects = [
  { id: "1", name: "E-Commerce Platform", storiesCount: 24, testsCount: 156 },
  { id: "2", name: "Mobile App API", storiesCount: 18, testsCount: 89 },
  { id: "3", name: "Admin Dashboard", storiesCount: 12, testsCount: 67 },
]

export function ProjectSelector() {
  const currentProject = projects[0] // Mock current project

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="flex items-center gap-2 min-w-[200px] justify-between">
          <div className="flex items-center gap-2">
            <FolderOpen className="w-4 h-4" />
            <span className="truncate">{currentProject.name}</span>
          </div>
          <ChevronDown className="w-4 h-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-80">
        <DropdownMenuLabel>Switch Project</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {projects.map((project) => (
          <DropdownMenuItem key={project.id} className="flex items-center justify-between p-3">
            <div className="flex-1">
              <div className="font-medium">{project.name}</div>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant="secondary" className="text-xs">
                  {project.storiesCount} stories
                </Badge>
                <Badge variant="secondary" className="text-xs">
                  {project.testsCount} tests
                </Badge>
              </div>
            </div>
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/projects/new" className="flex items-center gap-2">
            <Plus className="w-4 h-4" />
            Create New Project
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

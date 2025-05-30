"use client";
import { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Search,
  User,
  Calendar,
  Tag,
  Sparkles,
  GitBranch,
  ArrowRight,
  Users,
  ChevronDown,
  ChevronRight,
  RefreshCw,
  Database,
  Cloud,
  CheckCircle,
} from "lucide-react";
import { WorkItem } from "@/lib/types";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { TestGenerationDialog } from "@/components/test-generation/test-generation-dialog";
import { toast } from "sonner";

interface WorkItemsListProps {
  organization: string;
  project: string;
  token: string;
  projectId?: string;
}

interface WorkItemsResponse {
  workItems: WorkItem[];
  total: number;
  summary: {
    userStories: number;
    tasks: number;
    bugs: number;
    features: number;
    withRelationships: number;
  };
}

export function WorkItemsList({
  organization,
  project,
  token,
  projectId,
}: WorkItemsListProps) {
  const [workItems, setWorkItems] = useState<WorkItem[]>([]);
  const [summary, setSummary] = useState<WorkItemsResponse["summary"] | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [showHierarchy, setShowHierarchy] = useState(() => {
    // Try to get the saved preference from localStorage
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem(`hierarchy-view-${projectId}`);
      return saved !== null ? saved === "true" : true;
    }
    return true;
  });
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const [dataSource, setDataSource] = useState<"database" | "live">("database");

  // Test generation dialog state
  const [testDialogOpen, setTestDialogOpen] = useState(false);
  const [selectedWorkItem, setSelectedWorkItem] = useState<WorkItem | null>(
    null,
  );

  useEffect(() => {
    fetchWorkItems();
  }, [organization, project, token, projectId, dataSource]);

  async function fetchWorkItems() {
    setLoading(true);
    setError(null);
    try {
      let data: WorkItemsResponse;

      if (dataSource === "database" && projectId) {
        // Try to fetch from database first
        const params = new URLSearchParams({ projectId });
        const res = await fetch(`/api/work-items?${params}`);

        if (res.ok) {
          data = await res.json();
          // If no work items in database, fall back to live data
          if (data.workItems.length === 0) {
            setDataSource("live");
            return; // This will trigger useEffect again with live data
          }
        } else {
          throw new Error("Failed to fetch work items from database");
        }
      } else {
        // Fetch project details to get work item types if available
        let workItemTypes;
        if (projectId) {
          try {
            const projectRes = await fetch(`/api/projects?id=${projectId}`);
            if (projectRes.ok) {
              const projectData = await projectRes.json();
              workItemTypes = projectData.workItemTypes;
            }
          } catch (err) {
            console.error("Failed to fetch project details:", err);
          }
        }

        // Fetch from Azure DevOps directly
        const params = new URLSearchParams({
          organization,
          project,
          pat: token,
        });

        // Add work item types if available
        if (workItemTypes) {
          params.append("workItemTypes", JSON.stringify(workItemTypes));
        }

        const res = await fetch(`/api/azure/work-items?${params}`);
        if (!res.ok)
          throw new Error("Failed to fetch work items from Azure DevOps");
        data = await res.json();
      }

      setWorkItems(data.workItems || []);
      setSummary(data.summary);

      // Auto-expand user stories that have children
      const userStoriesWithChildren = data.workItems
        .filter((item) => item.isUserStory && item.hasChildren)
        .map((item) => item.id);
      setExpandedItems(new Set(userStoriesWithChildren));
    } catch (err: any) {
      setError(err.message || "Failed to fetch work items");
    } finally {
      setLoading(false);
    }
  }

  async function syncWorkItems() {
    if (!projectId) {
      toast.error("Project ID is required for syncing");
      return;
    }

    setSyncing(true);
    try {
      const response = await fetch("/api/azure/work-items/sync", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          projectId,
          organization,
          project,
          pat: token,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to sync work items");
      }

      const result = await response.json();
      const deletedText = result.deleted > 0 ? `, ${result.deleted} deleted` : '';
      toast.success(
        `Sync completed: ${result.synced} new, ${result.updated} updated${deletedText}`,
      );

      // Switch to database view and refresh
      setDataSource("database");
      fetchWorkItems();
    } catch (err: any) {
      toast.error(err.message || "Failed to sync work items");
    } finally {
      setSyncing(false);
    }
  }

  // Save hierarchy view preference when it changes
  useEffect(() => {
    if (typeof window !== "undefined" && projectId) {
      localStorage.setItem(
        `hierarchy-view-${projectId}`,
        showHierarchy.toString(),
      );
    }
  }, [showHierarchy, projectId]);

  const toggleExpanded = (itemId: string) => {
    const newExpanded = new Set(expandedItems);
    if (newExpanded.has(itemId)) {
      newExpanded.delete(itemId);
    } else {
      newExpanded.add(itemId);
    }
    setExpandedItems(newExpanded);
  };

  // Build tree structure for hierarchy view
  const buildTreeStructure = (items: WorkItem[]) => {
    
    // Check what parent-child relationships exist
    const itemMap = new Map<string, WorkItem & { computedChildren: WorkItem[] }>();
    const rootItems: (WorkItem & { computedChildren: WorkItem[] })[] = [];

    // First pass: create map of all items with empty children arrays
    items.forEach(item => {
      itemMap.set(item.id, { ...item, computedChildren: [] });
    });

    // Second pass: build parent-child relationships
    items.forEach(item => {
      const currentItem = itemMap.get(item.id)!;
      
      // If item has a parent, add it to parent's children
      if (item.parentId && itemMap.has(item.parentId)) {
        const parent = itemMap.get(item.parentId)!;
        parent.computedChildren.push(currentItem);
      } else {
        // No parent, so it's a root item
        rootItems.push(currentItem);
      }
    });
    return rootItems;
  };

  const filteredWorkItems = workItems.filter((item: WorkItem) => {
    const matchesFilter = filter === "all" || item.workItemType === filter;
    const matchesSearch =
      item.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.description.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  // Organize work items based on view mode
  const organizedWorkItems = showHierarchy 
    ? buildTreeStructure(filteredWorkItems)
    : filteredWorkItems.map(item => ({ ...item, computedChildren: [] }));

  const getWorkItemTypeColor = (type: string) => {
    switch (type) {
      case "User Story":
        return "bg-blue-100 text-blue-800";
      case "Task":
        return "bg-green-100 text-green-800";
      case "Bug":
        return "bg-red-100 text-red-800";
      case "Feature":
        return "bg-purple-100 text-purple-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getStateColor = (state: string) => {
    switch (state.toLowerCase()) {
      case "new":
        return "bg-gray-100 text-gray-800";
      case "active":
        return "bg-yellow-100 text-yellow-800";
      case "resolved":
        return "bg-blue-100 text-blue-800";
      case "closed":
        return "bg-green-100 text-green-800";
      case "done":
        return "bg-green-100 text-green-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getChildWorkItems = (parentId: string): WorkItem[] => {
    return workItems.filter((item) => item.parentId === parentId);
  };

  const renderWorkItemTree = (item: WorkItem & { computedChildren: WorkItem[] }, level: number = 0) => (
    <div key={item.id} className={level > 0 ? "ml-6 border-l-2 border-gray-200 pl-4" : ""}>
      <Card className="hover:shadow-md transition-shadow mb-2">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                {item.computedChildren.length > 0 && (
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="p-0 h-auto"
                    onClick={() => toggleExpanded(item.id)}
                  >
                    {expandedItems.has(item.id) ? (
                      <ChevronDown className="w-4 h-4" />
                    ) : (
                      <ChevronRight className="w-4 h-4" />
                    )}
                  </Button>
                )}
                <Badge className={getWorkItemTypeColor(item.workItemType)}>
                  {item.workItemType}
                </Badge>
                <Badge variant="outline" className={getStateColor(item.state)}>
                  {item.state}
                </Badge>
                <span className="text-sm text-gray-500">#{item.id}</span>
                {item.computedChildren.length > 0 && (
                  <Badge variant="secondary" className="text-xs">
                    <Users className="w-3 h-3 mr-1" />
                    {item.computedChildren.length} child{item.computedChildren.length !== 1 ? "ren" : ""}
                  </Badge>
                )}
                {level > 0 && (
                  <Badge variant="outline" className="text-xs">
                    <GitBranch className="w-3 h-3 mr-1" />
                    Child item
                  </Badge>
                )}
              </div>
              <CardTitle className="text-lg">{item.title}</CardTitle>
              {item.description && (
                <CardDescription className="mt-1 line-clamp-2">
                  {item.description.replace(/<[^>]*>/g, "")}
                </CardDescription>
              )}
              {item.acceptanceCriteria && (
                <div className="mt-2 p-2 bg-blue-50 rounded text-sm">
                  <strong>Acceptance Criteria:</strong>
                  <div className="mt-1 text-gray-700">
                    {item.acceptanceCriteria
                      .replace(/<[^>]*>/g, "")
                      .substring(0, 200)}
                    ...
                  </div>
                </div>
              )}
            </div>
            <Button
              variant="outline"
              size="sm"
              className="flex items-center gap-1"
              onClick={() => handleGenerateTests(item)}
            >
              <Sparkles className="w-3 h-3" />
              Generate Tests
            </Button>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="flex items-center justify-between text-sm text-gray-500">
            <div className="flex items-center gap-4">
              {item.assignedTo && (
                <div className="flex items-center gap-1">
                  <User className="w-3 h-3" />
                  <span>{item.assignedTo}</span>
                </div>
              )}
              {item.priority && (
                <div className="flex items-center gap-1">
                  <span>Priority: {item.priority}</span>
                </div>
              )}
            </div>
            <div className="flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              <span>
                {item.changedDate
                  ? new Date(item.changedDate).toLocaleDateString()
                  : "N/A"}
              </span>
            </div>
          </div>
          {item.tags.length > 0 && (
            <div className="flex items-center gap-2 mt-2">
              <Tag className="w-3 h-3 text-gray-400" />
              <div className="flex gap-1 flex-wrap">
                {item.tags.map((tag, index) => (
                  <Badge key={index} variant="secondary" className="text-xs">
                    {tag}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Related Items */}
          {item.relatedItems.length > 0 && (
            <div className="mt-3 pt-3 border-t">
              <div className="text-xs text-gray-500 mb-2">Related Items:</div>
              <div className="flex gap-2 flex-wrap">
                {item.relatedItems.slice(0, 3).map((related) => (
                  <Badge key={related.id} variant="outline" className="text-xs">
                    <ArrowRight className="w-3 h-3 mr-1" />
                    {related.workItemType} #{related.id}
                  </Badge>
                ))}
                {item.relatedItems.length > 3 && (
                  <Badge variant="outline" className="text-xs">
                    +{item.relatedItems.length - 3} more
                  </Badge>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
      
      {/* Render children if expanded */}
      {item.computedChildren.length > 0 && expandedItems.has(item.id) && (
        <div className="mt-2">
          {item.computedChildren.map((childItem) => 
            renderWorkItemTree(childItem as WorkItem & { computedChildren: WorkItem[] }, level + 1)
          )}
        </div>
      )}
    </div>
  );

  const handleGenerateTests = (workItem: WorkItem) => {
    if (!projectId) {
      alert("Project ID is required for test generation");
      return;
    }
    setSelectedWorkItem(workItem);
    setTestDialogOpen(true);
  };

  if (loading) {
    return <div className="text-center py-8">Loading work items...</div>;
  }

  if (error) {
    return <div className="text-center text-red-600 py-8">{error}</div>;
  }

  return (
    <div className="space-y-6">
      {/* Summary Stats */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <Card className="p-4">
            <div className="text-2xl font-bold text-blue-600">
              {summary.userStories}
            </div>
            <div className="text-sm text-gray-600">User Stories</div>
          </Card>
          <Card className="p-4">
            <div className="text-2xl font-bold text-green-600">
              {summary.tasks}
            </div>
            <div className="text-sm text-gray-600">Tasks</div>
          </Card>
          <Card className="p-4">
            <div className="text-2xl font-bold text-red-600">
              {summary.bugs}
            </div>
            <div className="text-sm text-gray-600">Bugs</div>
          </Card>
          <Card className="p-4">
            <div className="text-2xl font-bold text-purple-600">
              {summary.features}
            </div>
            <div className="text-sm text-gray-600">Features</div>
          </Card>
          <Card className="p-4">
            <div className="text-2xl font-bold text-orange-600">
              {summary.withRelationships}
            </div>
            <div className="text-sm text-gray-600">With Relations</div>
          </Card>
        </div>
      )}

      {/* Data Source and Sync Controls */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between p-4 bg-gray-50 rounded-lg">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">Data Source:</span>
            <Badge
              variant={dataSource === "database" ? "default" : "secondary"}
              className="flex items-center gap-1"
            >
              {dataSource === "database" ? (
                <Database className="w-3 h-3" />
              ) : (
                <Cloud className="w-3 h-3" />
              )}
              {dataSource === "database" ? "Database" : "Live (Azure DevOps)"}
            </Badge>
          </div>
          {dataSource === "database" && workItems.length > 0 && (
            <div className="flex items-center gap-1 text-sm text-gray-600">
              <CheckCircle className="w-3 h-3 text-green-600" />
              Last synced:{" "}
              {workItems[0]?.lastSyncAt
                ? new Date(workItems[0].lastSyncAt).toLocaleString()
                : "Unknown"}
            </div>
          )}
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              setDataSource(dataSource === "database" ? "live" : "database")
            }
            className="flex items-center gap-1"
          >
            {dataSource === "database" ? (
              <Cloud className="w-3 h-3" />
            ) : (
              <Database className="w-3 h-3" />
            )}
            Switch to {dataSource === "database" ? "Live" : "Database"}
          </Button>
          {projectId && (
            <Button
              variant="default"
              size="sm"
              onClick={syncWorkItems}
              disabled={syncing}
              className="flex items-center gap-1"
            >
              <RefreshCw
                className={`w-3 h-3 ${syncing ? "animate-spin" : ""}`}
              />
              {syncing ? "Syncing..." : "Sync from Azure"}
            </Button>
          )}
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
          <Input
            placeholder="Search work items..."
            className="pl-10"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue placeholder="Filter by type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="User Story">User Stories</SelectItem>
            <SelectItem value="Task">Tasks</SelectItem>
            <SelectItem value="Bug">Bugs</SelectItem>
            <SelectItem value="Feature">Features</SelectItem>
          </SelectContent>
        </Select>
        <Button
          variant={showHierarchy ? "default" : "outline"}
          onClick={() => setShowHierarchy(!showHierarchy)}
          className="flex items-center gap-2"
        >
          <GitBranch className="w-4 h-4" />
          {showHierarchy ? "Hierarchy View" : "Flat View"}
        </Button>
      </div>

      <div className="text-sm text-gray-600">
        Showing {organizedWorkItems.length} of {workItems.length} work items
        {showHierarchy && " (hierarchical view)"}
      </div>

      <div className="grid gap-4">
        {organizedWorkItems.map((item) => renderWorkItemTree(item))}
      </div>

      {organizedWorkItems.length === 0 && (
        <div className="text-center text-gray-500 py-8">
          No work items found matching your criteria.
        </div>
      )}

      {/* Test Generation Dialog */}
      {selectedWorkItem && projectId && (
        <TestGenerationDialog
          open={testDialogOpen}
          onOpenChange={setTestDialogOpen}
          workItem={selectedWorkItem}
          projectId={projectId}
        />
      )}
    </div>
  );
}

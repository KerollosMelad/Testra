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
  Minus,
  Plus,
} from "lucide-react";
import { WorkItem, WorkItemRelation } from "@/lib/types";
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

interface TreeNode {
  id: string;
  title: string;
  description: string;
  workItemType: "User Story" | "Task" | "Bug" | "Feature";
  state: string;
  assignedTo?: string;
  priority?: number;
  acceptanceCriteria?: string;
  tags: string[];
  createdDate: string | null;
  changedDate: string | null;
  parentId?: string;
  relatedItems: WorkItemRelation[];
  isUserStory: boolean;
  isTask: boolean;
  hasChildren: boolean;
  hasParent: boolean;
  lastSyncAt?: string | null;
  children: TreeNode[];
  level: number;
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
  const [showHierarchy, setShowHierarchy] = useState(true);
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const [dataSource, setDataSource] = useState<"database" | "live">("database");

  // Test generation dialog state
  const [testDialogOpen, setTestDialogOpen] = useState(false);
  const [selectedWorkItem, setSelectedWorkItem] = useState<WorkItem | null>(
    null,
  );

  // Load hierarchy preference from localStorage after hydration
  useEffect(() => {
    if (typeof window !== "undefined" && projectId) {
      const saved = localStorage.getItem(`hierarchy-view-${projectId}`);
      if (saved !== null) {
        setShowHierarchy(saved === "true");
      }
    }
  }, [projectId]);

  useEffect(() => {
    fetchWorkItems();
  }, [organization, project, token, projectId, dataSource]);

  async function fetchWorkItems() {
    setLoading(true);
    setError(null);
    try {
      let data: WorkItemsResponse;

      if (dataSource === "database" && projectId) {
        const params = new URLSearchParams({ projectId });
        const res = await fetch(`/api/work-items?${params}`);

        if (res.ok) {
          data = await res.json();
          if (data.workItems.length === 0) {
            // No items in database, continue to fetch live data
          } else {
            // Set data from database
            setWorkItems(data.workItems || []);
            setSummary(data.summary);

            // Auto-expand parent items that have children
            const parentIds = data.workItems
              .filter((item) => data.workItems.some((child) => child.parentId === item.id))
              .map((item) => item.id);
            setExpandedItems(new Set(parentIds));
            setLoading(false);
            return;
          }
        } else {
          throw new Error("Failed to fetch work items from database");
        }
      }

      // Fetch from Azure DevOps (either directly or as fallback)
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

      const params = new URLSearchParams({
        organization,
        project,
        pat: token,
      });

      if (workItemTypes) {
        params.append("workItemTypes", JSON.stringify(workItemTypes));
      }

      const res = await fetch(`/api/azure/work-items?${params}`);
      if (!res.ok)
        throw new Error("Failed to fetch work items from Azure DevOps");
      data = await res.json();

      setWorkItems(data.workItems || []);
      setSummary(data.summary);

      // Auto-expand parent items that have children
      const parentIds = data.workItems
        .filter((item) => data.workItems.some((child) => child.parentId === item.id))
        .map((item) => item.id);
      setExpandedItems(new Set(parentIds));
    } catch (err: any) {
      console.error("Error fetching work items:", err);
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
      // Show initial progress message
      toast.info("Starting sync from Azure DevOps...", { duration: 2000 });

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
          includeEmbeddings: true, // Enable automatic embedding creation
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to sync work items");
      }

      const result = await response.json();
      
      // Build comprehensive success message
      const deletedText = result.deleted > 0 ? `, ${result.deleted} deleted` : '';
      const embeddingText = result.embeddingsCreated > 0 
        ? `, ${result.embeddingsCreated} embeddings created` 
        : result.embeddingService === 'disabled' 
          ? ' (embeddings disabled - configure OpenAI API key to enable)' 
          : '';
      
      toast.success(
        `Sync completed: ${result.synced} new, ${result.updated} updated${deletedText}${embeddingText}`,
        { duration: 5000 }
      );

      setDataSource("database");
      fetchWorkItems();
    } catch (err: any) {
      toast.error(err.message || "Failed to sync work items");
    } finally {
      setSyncing(false);
    }
  }

  // Save hierarchy view preference
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

  // Build tree structure
  const buildTree = (items: WorkItem[]): TreeNode[] => {
    const itemMap = new Map<string, TreeNode>();
    const rootItems: TreeNode[] = [];

    // First pass: convert all items to tree nodes
    items.forEach(item => {
      itemMap.set(item.id, {
        ...item,
        children: [],
        level: 0,
      });
    });

    // Second pass: organize into parent-child relationships
    items.forEach(item => {
      const node = itemMap.get(item.id)!;
      
      if (item.parentId && itemMap.has(item.parentId)) {
        // This item has a parent - add it to parent's children
        const parent = itemMap.get(item.parentId)!;
        node.level = parent.level + 1;
        parent.children.push(node);
      } else {
        // Either no parent or parent not in filtered results - treat as root
        rootItems.push(node);
      }
    });

    return rootItems;
  };

  // Filter work items
  const filteredWorkItems = workItems.filter((item: WorkItem) => {
    const matchesFilter = filter === "all" || item.workItemType === filter;
    const matchesSearch =
      item.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.description.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  // Get organized work items based on view mode
  const organizedWorkItems = showHierarchy 
    ? buildTree(filteredWorkItems)
    : filteredWorkItems.map(item => ({ ...item, children: [], level: 0 } as TreeNode));

  const getWorkItemTypeColor = (type: string) => {
    switch (type) {
      case "User Story":
        return "bg-blue-100 text-blue-800 border-blue-200";
      case "Task":
        return "bg-green-100 text-green-800 border-green-200";
      case "Bug":
        return "bg-red-100 text-red-800 border-red-200";
      case "Feature":
        return "bg-indigo-100 text-indigo-800 border-indigo-200";
      default:
        return "bg-gray-100 text-gray-800 border-gray-200";
    }
  };

  const getStateColor = (state: string) => {
    switch (state.toLowerCase()) {
      case "new":
        return "bg-gray-100 text-gray-800 border-gray-200";
      case "active":
        return "bg-yellow-100 text-yellow-800 border-yellow-200";
      case "resolved":
        return "bg-blue-100 text-blue-800 border-blue-200";
      case "closed":
      case "done":
        return "bg-green-100 text-green-800 border-green-200";
      default:
        return "bg-gray-100 text-gray-800 border-gray-200";
    }
  };

  const renderWorkItem = (node: TreeNode) => {
    const hasChildren = node.children.length > 0;
    const isExpanded = expandedItems.has(node.id);
    const indentClass = node.level > 0 ? `ml-${Math.min(node.level * 8, 32)}` : "";

    return (
      <div key={node.id} className={`${indentClass}`}>
        {/* Work Item Card */}
        <Card className={`hover:shadow-md transition-all duration-200 mb-3 ${
          node.level > 0 ? 'border-l-4 border-l-blue-200 bg-blue-50/30' : ''
        }`}>
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                {/* Header with expand/collapse and badges */}
                <div className="flex items-center gap-2 mb-2 flex-wrap">
                  {hasChildren && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="p-1 h-6 w-6 rounded-full hover:bg-gray-200"
                      onClick={() => toggleExpanded(node.id)}
                    >
                      {isExpanded ? (
                        <Minus className="w-3 h-3" />
                      ) : (
                        <Plus className="w-3 h-3" />
                      )}
                    </Button>
                  )}
                  {!hasChildren && node.level > 0 && (
                    <div className="w-6 h-6 flex items-center justify-center">
                      <div className="w-2 h-2 bg-gray-300 rounded-full"></div>
                    </div>
                  )}
                  
                  <Badge className={getWorkItemTypeColor(node.workItemType)}>
                    {node.workItemType}
                  </Badge>
                  
                  <Badge variant="outline" className={getStateColor(node.state)}>
                    {node.state}
                  </Badge>
                  
                  <Badge variant="secondary" className="text-xs">
                    #{node.id}
                  </Badge>

                  {hasChildren && (
                    <Badge variant="secondary" className="text-xs">
                      <Users className="w-3 h-3 mr-1" />
                      {node.children.length} child{node.children.length !== 1 ? "ren" : ""}
                    </Badge>
                  )}

                  {node.level > 0 && (
                    <Badge variant="outline" className="text-xs">
                      <GitBranch className="w-3 h-3 mr-1" />
                      Child item
                    </Badge>
                  )}
                </div>

                {/* Title and Description */}
                <CardTitle className="text-lg leading-tight mb-2">
                  {node.title}
                </CardTitle>
                
                {node.description && (
                  <CardDescription className="line-clamp-2 text-sm">
                    {node.description.replace(/<[^>]*>/g, "")}
                  </CardDescription>
                )}

                {/* Acceptance Criteria */}
                {node.acceptanceCriteria && (
                  <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <div className="text-xs font-medium text-blue-800 mb-1">
                      Acceptance Criteria:
                    </div>
                    <div className="text-sm text-blue-700 line-clamp-3">
                      {node.acceptanceCriteria.replace(/<[^>]*>/g, "")}
                    </div>
                  </div>
                )}
              </div>

              {/* Generate Tests Button */}
              <Button
                variant="outline"
                size="sm"
                className="flex items-center gap-2 shrink-0"
                onClick={() => handleGenerateTests(node)}
              >
                <Sparkles className="w-4 h-4" />
                Generate Tests
              </Button>
            </div>
          </CardHeader>

          <CardContent className="pt-0">
            {/* Metadata */}
            <div className="flex items-center justify-between text-sm text-gray-600 mb-3">
              <div className="flex items-center gap-4 flex-wrap">
                {node.assignedTo && (
                  <div className="flex items-center gap-1">
                    <User className="w-4 h-4" />
                    <span>{node.assignedTo}</span>
                  </div>
                )}
                {node.priority && (
                  <div className="flex items-center gap-1">
                    <span className="font-medium">Priority:</span>
                    <span>{node.priority}</span>
                  </div>
                )}
              </div>
              <div className="flex items-center gap-1 text-xs">
                <Calendar className="w-3 h-3" />
                <span>
                  {node.changedDate
                    ? new Date(node.changedDate).toLocaleDateString()
                    : "N/A"}
                </span>
              </div>
            </div>

            {/* Tags */}
            {node.tags.length > 0 && (
              <div className="flex items-start gap-2 mb-3">
                <Tag className="w-4 h-4 text-gray-400 mt-0.5" />
                <div className="flex gap-1 flex-wrap">
                  {node.tags.map((tag, index) => (
                    <Badge key={index} variant="secondary" className="text-xs">
                      {tag}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Related Items */}
            {node.relatedItems.length > 0 && (
              <div className="pt-3 border-t border-gray-200">
                <div className="text-xs font-medium text-gray-600 mb-2">
                  Related Items:
                </div>
                <div className="flex gap-2 flex-wrap">
                  {node.relatedItems.slice(0, 4).map((related) => (
                    <Badge key={related.id} variant="outline" className="text-xs">
                      <ArrowRight className="w-3 h-3 mr-1" />
                      {related.workItemType} #{related.id}
                    </Badge>
                  ))}
                  {node.relatedItems.length > 4 && (
                    <Badge variant="outline" className="text-xs">
                      +{node.relatedItems.length - 4} more
                    </Badge>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Render Children */}
        {hasChildren && isExpanded && (
          <div className="space-y-0">
            {node.children.map((child) => renderWorkItem(child))}
          </div>
        )}
      </div>
    );
  };

  const handleGenerateTests = (node: TreeNode) => {
    if (!projectId) {
      toast.error("Project ID is required for test generation");
      return;
    }
    // Convert TreeNode to WorkItem for the dialog
    const workItem: WorkItem = {
      id: node.id,
      title: node.title,
      description: node.description,
      workItemType: node.workItemType,
      state: node.state,
      assignedTo: node.assignedTo,
      priority: node.priority,
      acceptanceCriteria: node.acceptanceCriteria,
      tags: node.tags,
      createdDate: node.createdDate,
      changedDate: node.changedDate,
      parentId: node.parentId,
      children: [], // Empty array for WorkItem children
      relatedItems: node.relatedItems,
      isUserStory: node.isUserStory,
      isTask: node.isTask,
      hasChildren: node.hasChildren,
      hasParent: node.hasParent,
      lastSyncAt: node.lastSyncAt,
    };
    setSelectedWorkItem(workItem);
    setTestDialogOpen(true);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <RefreshCw className="w-8 h-8 animate-spin text-primary mx-auto mb-2" />
          <p className="text-gray-600">Loading work items...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <div className="text-red-600 mb-4">{error}</div>
        <Button onClick={fetchWorkItems} variant="outline">
          Try Again
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Stats */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <Card className="p-4 text-center">
            <div className="text-2xl font-bold text-blue-600">
              {summary.userStories}
            </div>
            <div className="text-sm text-gray-600">User Stories</div>
          </Card>
          <Card className="p-4 text-center">
            <div className="text-2xl font-bold text-green-600">
              {summary.tasks}
            </div>
            <div className="text-sm text-gray-600">Tasks</div>
          </Card>
          <Card className="p-4 text-center">
            <div className="text-2xl font-bold text-red-600">
              {summary.bugs}
            </div>
            <div className="text-sm text-gray-600">Bugs</div>
          </Card>
          <Card className="p-4 text-center">
            <div className="text-2xl font-bold text-purple-600">
              {summary.features}
            </div>
            <div className="text-sm text-gray-600">Features</div>
          </Card>
          <Card className="p-4 text-center">
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
              title="Sync work items from Azure DevOps and create embeddings for AI search"
            >
              <RefreshCw
                className={`w-3 h-3 ${syncing ? "animate-spin" : ""}`}
              />
              {syncing ? "Syncing & Embedding..." : "Sync & Embed"}
            </Button>
          )}
        </div>
      </div>

      {/* Search and Filter Controls */}
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
          {showHierarchy ? "Tree View" : "List View"}
        </Button>
      </div>

      {/* Results Count */}
      <div className="flex items-center justify-between text-sm text-gray-600">
        <span>
          Showing {organizedWorkItems.length} of {workItems.length} work items
          {showHierarchy && " (tree view)"}
        </span>
        {showHierarchy && organizedWorkItems.length > 0 && (
          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setExpandedItems(new Set(workItems.map(item => item.id)))}
              className="text-xs"
            >
              Expand All
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setExpandedItems(new Set())}
              className="text-xs"
            >
              Collapse All
            </Button>
          </div>
        )}
      </div>

      {/* Work Items List */}
      <div className="space-y-0">
        {organizedWorkItems.length > 0 ? (
          organizedWorkItems.map((item) => renderWorkItem(item))
        ) : (
          <div className="text-center text-gray-500 py-12">
            <div className="mb-4">
              <Search className="w-12 h-12 text-gray-300 mx-auto mb-2" />
              <p className="text-lg font-medium">No work items found</p>
              <p className="text-sm">Try adjusting your search or filter criteria</p>
            </div>
            {filter !== "all" && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setFilter("all")}
              >
                Clear Filter
              </Button>
            )}
          </div>
        )}
      </div>

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

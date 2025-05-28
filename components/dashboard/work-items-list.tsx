'use client'
import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, User, Calendar, Tag, Sparkles } from "lucide-react";
import { WorkItem } from "@/lib/types";

interface WorkItemsListProps {
  organization: string;
  project: string;
  token: string;
}

export function WorkItemsList({ organization, project, token }: WorkItemsListProps) {
  const [workItems, setWorkItems] = useState<WorkItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    async function fetchWorkItems() {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({
          organization,
          project,
          pat: token,
        });
        const res = await fetch(`/api/azure/work-items?${params}`);
        if (!res.ok) throw new Error('Failed to fetch work items');
        const data = await res.json();
        setWorkItems(data.workItems || []);
      } catch (err: any) {
        setError(err.message || 'Failed to fetch work items');
      } finally {
        setLoading(false);
      }
    }
    fetchWorkItems();
  }, [organization, project, token]);

  const filteredWorkItems = workItems.filter(item => {
    const matchesFilter = filter === 'all' || item.workItemType === filter;
    const matchesSearch = item.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         item.description.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  const getWorkItemTypeColor = (type: string) => {
    switch (type) {
      case 'User Story': return 'bg-blue-100 text-blue-800';
      case 'Task': return 'bg-green-100 text-green-800';
      case 'Bug': return 'bg-red-100 text-red-800';
      case 'Feature': return 'bg-purple-100 text-purple-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStateColor = (state: string) => {
    switch (state.toLowerCase()) {
      case 'new': return 'bg-gray-100 text-gray-800';
      case 'active': return 'bg-yellow-100 text-yellow-800';
      case 'resolved': return 'bg-blue-100 text-blue-800';
      case 'closed': return 'bg-green-100 text-green-800';
      case 'done': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return <div className="text-center py-8">Loading work items...</div>;
  }

  if (error) {
    return <div className="text-center text-red-600 py-8">{error}</div>;
  }

  return (
    <div className="space-y-6">
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
      </div>

      <div className="text-sm text-gray-600">
        Showing {filteredWorkItems.length} of {workItems.length} work items
      </div>

      <div className="grid gap-4">
        {filteredWorkItems.map((item) => (
          <Card key={item.id} className="hover:shadow-md transition-shadow">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <Badge className={getWorkItemTypeColor(item.workItemType)}>
                      {item.workItemType}
                    </Badge>
                    <Badge variant="outline" className={getStateColor(item.state)}>
                      {item.state}
                    </Badge>
                    <span className="text-sm text-gray-500">#{item.id}</span>
                  </div>
                  <CardTitle className="text-lg">{item.title}</CardTitle>
                  {item.description && (
                    <CardDescription className="mt-1 line-clamp-2">
                      {item.description.replace(/<[^>]*>/g, '')}
                    </CardDescription>
                  )}
                </div>
                <Button variant="outline" size="sm" className="flex items-center gap-1">
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
                  <span>{new Date(item.changedDate).toLocaleDateString()}</span>
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
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredWorkItems.length === 0 && (
        <div className="text-center text-gray-500 py-8">
          No work items found matching your criteria.
        </div>
      )}
    </div>
  );
} 
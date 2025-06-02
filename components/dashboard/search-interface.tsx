"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Slider } from "@/components/ui/slider"
import { Search, FileText, TestTube, AlertCircle, CheckCircle2, Loader2, Zap } from "lucide-react"
import { toast } from "sonner"

interface SearchResult {
  id: string
  title: string
  description: string
  type: string
  similarity: number
}

interface SearchResults {
  workItems: SearchResult[]
  testCases: SearchResult[]
  totalCount: number
  byType: {
    workItems: number
    testCases: number
  }
}

interface EmbeddingStatus {
  workItemsEmbedded: number
  testCasesEmbedded: number
  totalEmbedded: number
  lastUpdated: string | null
  isReady: boolean
  error?: string
}

interface SearchInterfaceProps {
  projectId: string
}

export function SearchInterface({ projectId }: SearchInterfaceProps) {
  const [query, setQuery] = useState("")
  const [searchType, setSearchType] = useState<"work-items" | "test-cases" | "both">("both")
  const [threshold, setThreshold] = useState([0.7])
  const [isSearching, setIsSearching] = useState(false)
  const [results, setResults] = useState<SearchResults | null>(null)
  const [isEmbedding, setIsEmbedding] = useState(false)
  const [embeddingStatus, setEmbeddingStatus] = useState<EmbeddingStatus | null>(null)
  const [projectApiKey, setProjectApiKey] = useState<string | null>(null)
  const [isLoadingStatus, setIsLoadingStatus] = useState(true)

  // Fetch project API key and initial embedding status
  useEffect(() => {
    fetchProjectInfo()
  }, [projectId])

  const fetchProjectInfo = async () => {
    try {
      setIsLoadingStatus(true)
      
      // Get project API key
      const projectResponse = await fetch(`/api/projects/${projectId}`)
      if (projectResponse.ok) {
        const projectData = await projectResponse.json()
        setProjectApiKey(projectData.openaiApiKey)
        
        // Only check embedding status if we have an API key
        if (projectData.openaiApiKey) {
          await checkEmbeddingStatus(projectData.openaiApiKey)
        } else {
          setEmbeddingStatus({
            workItemsEmbedded: 0,
            testCasesEmbedded: 0,
            totalEmbedded: 0,
            lastUpdated: null,
            isReady: false,
            error: 'OpenAI API key not configured for this project'
          })
        }
      }
    } catch (error) {
      console.error("Error fetching project info:", error)
      toast.error("Failed to fetch project information")
    } finally {
      setIsLoadingStatus(false)
    }
  }

  const handleSearch = async () => {
    if (!query.trim()) {
      toast.error("Please enter a search query")
      return
    }

    if (!embeddingStatus?.isReady) {
      toast.error("Embeddings are not ready. Please create embeddings first.")
      return
    }

    setIsSearching(true)
    try {
      const params = new URLSearchParams({
        projectId,
        query: query.trim(),
        type: searchType,
        threshold: threshold[0].toString(),
        limit: "10"
      })

      const response = await fetch(`/api/vector-search?${params}`)
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Search failed")
      }

      setResults(data.results)
      toast.success(`Found ${data.results.totalCount} results`)
    } catch (error) {
      console.error("Search error:", error)
      toast.error(error instanceof Error ? error.message : "Search failed")
      setResults(null)
    } finally {
      setIsSearching(false)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSearch()
    }
  }

  const checkEmbeddingStatus = async (apiKey?: string) => {
    try {
      const keyToUse = apiKey || projectApiKey
      if (!keyToUse) {
        setEmbeddingStatus({
          workItemsEmbedded: 0,
          testCasesEmbedded: 0,
          totalEmbedded: 0,
          lastUpdated: null,
          isReady: false,
          error: 'No API key available'
        })
        return
      }

      const response = await fetch("/api/vector-search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          apiKey: keyToUse,
          action: "check-status"
        })
      })

      const data = await response.json()
      if (response.ok) {
        setEmbeddingStatus(data.status)
      } else {
        throw new Error(data.error || "Failed to check status")
      }
    } catch (error) {
      console.error("Error checking embedding status:", error)
      setEmbeddingStatus({
        workItemsEmbedded: 0,
        testCasesEmbedded: 0,
        totalEmbedded: 0,
        lastUpdated: null,
        isReady: false,
        error: error instanceof Error ? error.message : 'Failed to check status'
      })
    }
  }

  const createEmbeddings = async () => {
    if (!projectApiKey) {
      toast.error("No OpenAI API key configured for this project")
      return
    }

    setIsEmbedding(true)
    try {
      const response = await fetch("/api/vector-search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          apiKey: projectApiKey,
          action: "embed-all"
        })
      })

      const data = await response.json()
      if (response.ok) {
        toast.success("Embeddings created successfully!")
        await checkEmbeddingStatus()
      } else {
        throw new Error(data.error || "Failed to create embeddings")
      }
    } catch (error) {
      console.error("Embedding error:", error)
      toast.error(error instanceof Error ? error.message : "Failed to create embeddings")
    } finally {
      setIsEmbedding(false)
    }
  }

  const triggerSync = async () => {
    if (!projectApiKey) {
      toast.error("No OpenAI API key configured for this project")
      return
    }

    setIsEmbedding(true)
    try {
      // This would trigger a sync that includes embedding creation
      toast.info("Sync with embedding creation would be triggered here")
      // You can implement this by calling the Azure sync endpoint
      // with embeddings enabled
    } catch (error) {
      console.error("Sync error:", error)
      toast.error("Failed to trigger sync")
    } finally {
      setIsEmbedding(false)
    }
  }

  if (isLoadingStatus) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin" />
          <span className="ml-2">Loading search interface...</span>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="w-5 h-5" />
            Semantic Search
          </CardTitle>
          <CardDescription>
            Search for similar work items and test cases using AI-powered semantic search
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Search Controls */}
          <div className="flex gap-2">
            <div className="flex-1">
              <Input
                placeholder="Search for work items, features, or test cases..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyPress={handleKeyPress}
                disabled={!embeddingStatus?.isReady}
              />
            </div>
            <Select value={searchType} onValueChange={(value: any) => setSearchType(value)}>
              <SelectTrigger className="w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="both">Both</SelectItem>
                <SelectItem value="work-items">Work Items</SelectItem>
                <SelectItem value="test-cases">Test Cases</SelectItem>
              </SelectContent>
            </Select>
            <Button 
              onClick={handleSearch} 
              disabled={isSearching || !embeddingStatus?.isReady}
            >
              {isSearching ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Search className="w-4 h-4" />
              )}
              Search
            </Button>
          </div>

          {/* Similarity Threshold */}
          <div className="space-y-2">
            <label className="text-sm font-medium">
              Similarity Threshold: {threshold[0].toFixed(2)}
            </label>
            <Slider
              value={threshold}
              onValueChange={setThreshold}
              max={1}
              min={0.1}
              step={0.05}
              className="w-full"
              disabled={!embeddingStatus?.isReady}
            />
            <p className="text-xs text-gray-500">
              Higher values return more similar results, lower values cast a wider net
            </p>
          </div>

          {/* Embedding Status */}
          {embeddingStatus && (
            <div className="p-4 border rounded-lg bg-gray-50">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  {embeddingStatus.isReady ? (
                    <CheckCircle2 className="w-5 h-5 text-green-600" />
                  ) : (
                    <AlertCircle className="w-5 h-5 text-yellow-600" />
                  )}
                  <span className="font-medium">
                    {embeddingStatus.isReady ? "Search Ready" : "Search Not Available"}
                  </span>
                </div>
                
                {!embeddingStatus.isReady && (
                  <div className="flex gap-2">
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={triggerSync} 
                      disabled={isEmbedding || !projectApiKey}
                    >
                      <Zap className="w-4 h-4 mr-1" />
                      Sync & Embed
                    </Button>
                    <Button 
                      size="sm" 
                      onClick={createEmbeddings} 
                      disabled={isEmbedding || !projectApiKey}
                    >
                      {isEmbedding ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        "Create Embeddings"
                      )}
                    </Button>
                  </div>
                )}
              </div>
              
              <div className="space-y-2 text-sm text-gray-600">
                {embeddingStatus.isReady ? (
                  <div>
                    <p>✅ {embeddingStatus.totalEmbedded} items indexed for search</p>
                    <p>📄 Work items: {embeddingStatus.workItemsEmbedded}</p>
                    <p>🧪 Test cases: {embeddingStatus.testCasesEmbedded}</p>
                    {embeddingStatus.lastUpdated && (
                      <p>🕒 Last updated: {new Date(embeddingStatus.lastUpdated).toLocaleString()}</p>
                    )}
                  </div>
                ) : (
                  <div>
                    <p className="text-yellow-700">
                      {embeddingStatus.error || "No embeddings found - search will not work"}
                    </p>
                    {!projectApiKey && (
                      <p className="text-red-600 text-xs">
                        Configure OpenAI API key in project settings to enable search
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Search Results */}
      {results && (
        <Card>
          <CardHeader>
            <CardTitle>Search Results</CardTitle>
            <CardDescription>
              Found {results.totalCount} results ({results.byType.workItems} work items, {results.byType.testCases} test cases)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="all" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="all">All ({results.totalCount})</TabsTrigger>
                <TabsTrigger value="work-items">
                  Work Items ({results.byType.workItems})
                </TabsTrigger>
                <TabsTrigger value="test-cases">
                  Test Cases ({results.byType.testCases})
                </TabsTrigger>
              </TabsList>

              <TabsContent value="all" className="space-y-3">
                {[...results.workItems, ...results.testCases]
                  .sort((a, b) => b.similarity - a.similarity)
                  .map((item) => (
                    <ResultCard key={`${item.type}-${item.id}`} result={item} />
                  ))}
              </TabsContent>

              <TabsContent value="work-items" className="space-y-3">
                {results.workItems.map((item) => (
                  <ResultCard key={item.id} result={item} />
                ))}
              </TabsContent>

              <TabsContent value="test-cases" className="space-y-3">
                {results.testCases.map((item) => (
                  <ResultCard key={item.id} result={item} />
                ))}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function ResultCard({ result }: { result: SearchResult }) {
  const isWorkItem = !["unit", "integration", "e2e", "api"].includes(result.type)
  
  return (
    <Card className="p-4 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            {isWorkItem ? (
              <FileText className="w-4 h-4 text-blue-600" />
            ) : (
              <TestTube className="w-4 h-4 text-green-600" />
            )}
            <h3 className="font-medium">{result.title}</h3>
            <Badge variant={isWorkItem ? "secondary" : "outline"}>
              {result.type}
            </Badge>
          </div>
          {result.description && (
            <p className="text-sm text-gray-600 line-clamp-2">
              {result.description}
            </p>
          )}
        </div>
        <div className="ml-4">
          <Badge 
            variant="outline" 
            className={`text-xs ${result.similarity > 0.8 ? 'bg-green-50 text-green-700' : result.similarity > 0.6 ? 'bg-yellow-50 text-yellow-700' : 'bg-gray-50'}`}
          >
            {(result.similarity * 100).toFixed(1)}% match
          </Badge>
        </div>
      </div>
    </Card>
  )
} 
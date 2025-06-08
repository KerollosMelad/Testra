"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { toast } from "sonner";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { ArrowLeft, Loader2, Trash2 } from "lucide-react";
import Link from "next/link";

const schema = z.object({
  name: z.string().min(1, "Project name is required"),
  description: z.string().optional(),
  organization: z.string().min(1, "Organization is required"),
  project: z.string().min(1, "Project is required"),
  pat: z.string().min(1, "Personal Access Token is required"),
  openaiApiKey: z.string().min(1, "OpenAI API Key is required"),
  aiModel: z.enum(["gpt-4o", "gpt-4o-mini", "gpt-4-turbo", "gpt-4-0125-preview", "gpt-4", "gpt-3.5-turbo-0125", "gpt-3.5-turbo"]),
  temperature: z.coerce.number().min(0).max(2),
  maxTokens: z.coerce.number().min(1),
  autoGeneration: z.boolean(),
  aiChat: z.boolean(),
  codeGeneration: z.boolean(),
  workItemTypes: z
    .array(z.string())
    .min(1, "Select at least one work item type"),
});

type FormValues = z.infer<typeof schema>;

export default function ProjectSettingsPage() {
  // Use the useParams hook to get the id parameter from the URL
  const routeParams = useParams();
  const id = routeParams?.id as string;
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [projectName, setProjectName] = useState<string>("");
  const router = useRouter();

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: "",
      description: "",
      organization: "",
      project: "",
      pat: "",
      openaiApiKey: "",
      aiModel: "gpt-4",
      temperature: 0.7,
      maxTokens: 1024,
      autoGeneration: true,
      aiChat: true,
      codeGeneration: true,
      workItemTypes: ["User Story", "Task", "Bug", "Feature"],
    },
  });

  useEffect(() => {
    async function fetchProject() {
      try {
        setLoading(true);
        const response = await fetch(`/api/projects?id=${id}`);
        if (!response.ok) {
          throw new Error("Failed to fetch project");
        }
        
        const project = await response.json();

        // Store project name for delete confirmation
        setProjectName(project.name);

        // Transform the snake_case fields back to camelCase
        form.reset({
          name: project.name,
          description: project.description || "",
          organization: project.organization,
          project: project.project,
          pat: project.token,
          openaiApiKey: project.openaiApiKey,
          aiModel: project.aiModel as "gpt-4o" | "gpt-4o-mini" | "gpt-4-turbo" | "gpt-4-0125-preview" | "gpt-4" | "gpt-3.5-turbo-0125" | "gpt-3.5-turbo",
          temperature: project.temperature,
          maxTokens: project.maxTokens,
          autoGeneration: project.autoGeneration,
          aiChat: project.aiChat,
          codeGeneration: project.codeGeneration,
          workItemTypes: project.workItemTypes || [
            "User Story",
            "Task",
            "Bug",
            "Feature",
          ],
        });
      } catch (err: any) {
        toast.error(err.message || "Failed to load project");
      } finally {
        setLoading(false);
      }
    }

    fetchProject();
  }, [id, form]);

  const handleTestConnection = async (values: FormValues) => {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch("/api/azure/test-connection", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organization: values.organization,
          project: values.project,
          pat: values.pat,
        }),
      });
      if (res.ok) {
        setTestResult("success");
        toast.success("Connection successful!");
      } else {
        setTestResult("error");
        toast.error("Connection failed. Check your credentials.");
      }
    } catch {
      setTestResult("error");
      toast.error("Connection test failed");
    } finally {
      setTesting(false);
    }
  };

  const onSubmit = async (values: FormValues) => {
    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await fetch(`/api/projects?id=${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: values.name,
          description: values.description,
          organization: values.organization,
          project: values.project,
          token: values.pat,
          openaiApiKey: values.openaiApiKey,
          aiModel: values.aiModel,
          temperature: values.temperature,
          maxTokens: values.maxTokens,
          autoGeneration: values.autoGeneration,
          aiChat: values.aiChat,
          codeGeneration: values.codeGeneration,
          workItemTypes: values.workItemTypes,
        }),
      });
      if (res.ok) {
        toast.success("Project updated successfully");
        router.push(`/projects/${id}`);
      } else {
        const data = await res.json();
        setSubmitError(data.error || "Failed to update project");
        toast.error(data.error || "Failed to update project");
      }
    } catch (err: any) {
      setSubmitError(err.message || "Failed to update project");
      toast.error(err.message || "Failed to update project");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteProject = async () => {
    setDeleting(true);
    try {
      const response = await fetch(`/api/projects?id=${id}`, {
        method: "DELETE",
      });

      if (response.ok) {
        const result = await response.json();
        toast.success(result.message || "Project deleted successfully");
        router.push("/"); // Redirect to home/projects list
      } else {
        const errorData = await response.json();
        toast.error(errorData.error || "Failed to delete project");
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to delete project");
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <span className="ml-2">Loading project settings...</span>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto p-8">
      <div className="flex items-center mb-6">
        <Link href={`/projects/${id}`} className="mr-4">
          <Button variant="outline" size="sm">
            <ArrowLeft className="w-4 h-4 mr-1" />
            Back to Project
          </Button>
        </Link>
        <h2 className="text-2xl font-semibold">Edit Project Settings</h2>
      </div>

      <Form {...form}>
        <form className="space-y-6" onSubmit={form.handleSubmit(onSubmit)}>
          {/* Basic Project Information */}
          <Card>
            <CardHeader>
              <CardTitle>Project Information</CardTitle>
              <CardDescription>
                Basic details about your project
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Project Name</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="e.g. E-Commerce Platform"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea placeholder="Optional description" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          {/* Azure DevOps Configuration */}
          <Card>
            <CardHeader>
              <CardTitle>Azure DevOps Configuration</CardTitle>
              <CardDescription>
                Connection settings for Azure DevOps
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name="organization"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Organization</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. contoso" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="project"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Azure DevOps Project</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. ecommerce" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="pat"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Personal Access Token</FormLabel>
                    <FormControl>
                      <Input
                        type="password"
                        placeholder="Azure DevOps PAT"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="flex gap-4 items-center">
                <Button
                  type="button"
                  onClick={form.handleSubmit(handleTestConnection)}
                  disabled={testing}
                  variant="secondary"
                >
                  {testing ? "Testing..." : "Test Connection"}
                </Button>
                {testResult === "success" && (
                  <span className="text-green-600 font-medium">
                    ✓ Connection successful!
                  </span>
                )}
                {testResult === "error" && (
                  <span className="text-red-600 font-medium">
                    ✗ Connection failed. Check details.
                  </span>
                )}
              </div>

              <FormField
                control={form.control}
                name="workItemTypes"
                render={() => (
                  <FormItem>
                    <div className="mb-4">
                      <FormLabel className="text-base">
                        Work Item Types
                      </FormLabel>
                      <div className="text-sm text-muted-foreground">
                        Select which work item types to load from Azure DevOps
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="workItemTypes"
                        render={({ field }) => {
                          return (
                            <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                              <FormControl>
                                <Checkbox
                                  checked={field.value?.includes("Feature")}
                                  onCheckedChange={(checked) => {
                                    return checked
                                      ? field.onChange([
                                          ...field.value,
                                          "Feature",
                                        ])
                                      : field.onChange(
                                          field.value?.filter(
                                            (value) => value !== "Feature",
                                          ),
                                        );
                                  }}
                                />
                              </FormControl>
                              <FormLabel className="font-normal">
                                Feature
                              </FormLabel>
                            </FormItem>
                          );
                        }}
                      />
                      <FormField
                        control={form.control}
                        name="workItemTypes"
                        render={({ field }) => {
                          return (
                            <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                              <FormControl>
                                <Checkbox
                                  checked={field.value?.includes("User Story")}
                                  onCheckedChange={(checked) => {
                                    return checked
                                      ? field.onChange([
                                          ...field.value,
                                          "User Story",
                                        ])
                                      : field.onChange(
                                          field.value?.filter(
                                            (value) => value !== "User Story",
                                          ),
                                        );
                                  }}
                                />
                              </FormControl>
                              <FormLabel className="font-normal">
                                User Story
                              </FormLabel>
                            </FormItem>
                          );
                        }}
                      />
                      <FormField
                        control={form.control}
                        name="workItemTypes"
                        render={({ field }) => {
                          return (
                            <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                              <FormControl>
                                <Checkbox
                                  checked={field.value?.includes("Task")}
                                  onCheckedChange={(checked) => {
                                    return checked
                                      ? field.onChange([...field.value, "Task"])
                                      : field.onChange(
                                          field.value?.filter(
                                            (value) => value !== "Task",
                                          ),
                                        );
                                  }}
                                />
                              </FormControl>
                              <FormLabel className="font-normal">
                                Task
                              </FormLabel>
                            </FormItem>
                          );
                        }}
                      />
                      <FormField
                        control={form.control}
                        name="workItemTypes"
                        render={({ field }) => {
                          return (
                            <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                              <FormControl>
                                <Checkbox
                                  checked={field.value?.includes("Bug")}
                                  onCheckedChange={(checked) => {
                                    return checked
                                      ? field.onChange([...field.value, "Bug"])
                                      : field.onChange(
                                          field.value?.filter(
                                            (value) => value !== "Bug",
                                          ),
                                        );
                                  }}
                                />
                              </FormControl>
                              <FormLabel className="font-normal">Bug</FormLabel>
                            </FormItem>
                          );
                        }}
                      />
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          {/* AI Configuration */}
          <Card>
            <CardHeader>
              <CardTitle>AI Configuration</CardTitle>
              <CardDescription>
                Settings for AI-powered test generation
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name="openaiApiKey"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>OpenAI API Key</FormLabel>
                    <FormControl>
                      <Input type="password" placeholder="sk-..." {...field} />
                    </FormControl>
                    <div className="text-sm text-gray-500">
                      Get your API key from{" "}
                      <a
                        href="https://platform.openai.com/api-keys"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:underline"
                      >
                        OpenAI Dashboard
                      </a>
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <FormField
                  control={form.control}
                  name="aiModel"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>AI Model</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        value={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select AI Model" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="gpt-4o">GPT-4o</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="temperature"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Temperature</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.01"
                          min={0}
                          max={2}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="maxTokens"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Max Tokens</FormLabel>
                      <FormControl>
                        <Input type="number" min={1} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </CardContent>
          </Card>

          {/* Feature Toggles */}
          <Card>
            <CardHeader>
              <CardTitle>Features</CardTitle>
              <CardDescription>
                Enable or disable specific features
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <FormField
                  control={form.control}
                  name="autoGeneration"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                      <div className="space-y-1 leading-none">
                        <FormLabel>Auto Generation</FormLabel>
                        <p className="text-sm text-muted-foreground">
                          Automatically generate test cases
                        </p>
                      </div>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="aiChat"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                      <div className="space-y-1 leading-none">
                        <FormLabel>AI Chat</FormLabel>
                        <p className="text-sm text-muted-foreground">
                          Enable AI-powered chat assistance
                        </p>
                      </div>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="codeGeneration"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                      <div className="space-y-1 leading-none">
                        <FormLabel>Code Generation</FormLabel>
                        <p className="text-sm text-muted-foreground">
                          Generate code snippets and tests
                        </p>
                      </div>
                    </FormItem>
                  )}
                />
              </div>
            </CardContent>
          </Card>

          {/* Danger Zone */}
          <Card className="border-red-200">
            <CardHeader>
              <CardTitle className="text-red-600">Danger Zone</CardTitle>
              <CardDescription>
                Permanent actions that cannot be undone
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between p-4 bg-red-50 border border-red-200 rounded-lg">
                <div>
                  <h4 className="font-medium text-red-800">Delete Project</h4>
                  <p className="text-sm text-red-600 mt-1">
                    This will permanently delete the project and all associated data including work items, test cases, and relationships. This action cannot be undone.
                  </p>
                </div>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" size="sm" className="ml-4">
                      <Trash2 className="w-4 h-4 mr-1" />
                      Delete Project
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                      <AlertDialogDescription className="space-y-2">
                        <p>
                          This action will permanently delete the project <strong>"{projectName}"</strong> and all associated data:
                        </p>
                        <ul className="list-disc list-inside text-sm space-y-1 ml-4">
                          <li>All work items and their relationships</li>
                          <li>All test cases and test results</li>
                          <li>All project configuration and settings</li>
                          <li>All sync history and data</li>
                        </ul>
                        <p className="text-red-600 font-medium">
                          This action cannot be undone and data cannot be recovered.
                        </p>
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={handleDeleteProject}
                        disabled={deleting}
                        className="bg-red-600 hover:bg-red-700 focus:ring-red-600"
                      >
                        {deleting ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                            Deleting...
                          </>
                        ) : (
                          <>
                            <Trash2 className="w-4 h-4 mr-1" />
                            Delete Project
                          </>
                        )}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </CardContent>
          </Card>

          {submitError && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md">
              {submitError}
            </div>
          )}

          <div className="flex justify-end gap-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => router.push(`/projects/${id}`)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Saving Changes..." : "Save Changes"}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}

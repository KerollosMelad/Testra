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
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ArrowLeft, Loader2, Plus } from "lucide-react";
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

export default function NewProjectPage() {
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: "",
      description: "",
      organization: "",
      project: "",
      pat: "",
      openaiApiKey: "",
      aiModel: "gpt-4o",
      temperature: 0.7,
      maxTokens: 2000,
      autoGeneration: false,
      aiChat: false,
      codeGeneration: false,
      workItemTypes: [],
    },
  });
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const router = useRouter();

  const handleTestConnection = async (values: FormValues) => {
    console.log("DEBUG: handleTestConnection called", values);
    alert("DEBUG: handleTestConnection triggered!"); // Remove this after testing
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
      const res = await fetch("/api/projects", {
        method: "POST",
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
        const result = await res.json();
        toast.success("Project created successfully!");
        router.push(`/projects/${result.project.id}`);
      } else {
        const data = await res.json();
        setSubmitError(data.error || "Failed to create project");
        toast.error(data.error || "Failed to create project");
      }
    } catch (err: any) {
      setSubmitError(err.message || "Failed to create project");
      toast.error(err.message || "Failed to create project");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-8">
      <div className="flex items-center mb-6">
        <Link href="/" className="mr-4">
          <Button variant="outline" size="sm">
            <ArrowLeft className="w-4 h-4 mr-1" />
            Back to Projects
          </Button>
        </Link>
        <h2 className="text-2xl font-semibold">Create New Project</h2>
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
                              <FormLabel className="font-normal">Task</FormLabel>
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

          {submitError && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md">
              {submitError}
            </div>
          )}

          <div className="flex justify-end gap-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => router.push("/")}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                  Creating Project...
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4 mr-1" />
                  Create Project
                </>
              )}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}

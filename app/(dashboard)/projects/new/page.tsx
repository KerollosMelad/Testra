'use client'

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { useState } from "react";
import { useRouter } from "next/navigation";

const schema = z.object({
  name: z.string().min(1, "Project name is required"),
  description: z.string().optional(),
  organization: z.string().min(1, "Organization is required"),
  project: z.string().min(1, "Project is required"),
  pat: z.string().min(1, "Personal Access Token is required"),
  aiModel: z.enum(["gpt-4", "gpt-3.5-turbo"]),
  temperature: z.coerce.number().min(0).max(2),
  maxTokens: z.coerce.number().min(1),
  autoGeneration: z.boolean(),
  aiChat: z.boolean(),
  codeGeneration: z.boolean(),
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
      aiModel: "gpt-4",
      temperature: 0.7,
      maxTokens: 1024,
      autoGeneration: true,
      aiChat: true,
      codeGeneration: true,
    },
  });
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const router = useRouter();

  const handleTestConnection = async (values: FormValues) => {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch('/api/azure/test-connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organization: values.organization,
          project: values.project,
          pat: values.pat,
        }),
      });
      if (res.ok) {
        setTestResult('success');
      } else {
        setTestResult('error');
      }
    } catch {
      setTestResult('error');
    } finally {
      setTesting(false);
    }
  };

  const onSubmit = async (values: FormValues) => {
    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: values.name,
          description: values.description,
          organization: values.organization,
          project: values.project,
          token: values.pat,
          aiModel: values.aiModel,
          temperature: values.temperature,
          maxTokens: values.maxTokens,
          autoGeneration: values.autoGeneration,
          aiChat: values.aiChat,
          codeGeneration: values.codeGeneration,
        }),
      });
      if (res.ok) {
        router.push('/');
      } else {
        const data = await res.json();
        setSubmitError(data.error || 'Failed to add project');
      }
    } catch {
      setSubmitError('Failed to add project');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-8">
      <h2 className="text-2xl font-semibold mb-6">Connect Azure DevOps Project</h2>
      <Form {...form}>
        <form className="space-y-6" onSubmit={form.handleSubmit(onSubmit)}>
          {/* Basic Project Information */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium">Project Information</h3>
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Project Name</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. E-Commerce Platform" {...field} />
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
                    <Input placeholder="Optional description" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          {/* Azure DevOps Configuration */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium">Azure DevOps Configuration</h3>
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
                    <Input type="password" placeholder="Azure DevOps PAT" {...field} />
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
                <span className="text-green-600 font-medium">✓ Connection successful!</span>
              )}
              {testResult === "error" && (
                <span className="text-red-600 font-medium">✗ Connection failed. Check details.</span>
              )}
            </div>
          </div>

          {/* AI Configuration */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium">AI Configuration</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <FormField
                control={form.control}
                name="aiModel"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>AI Model</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select AI Model" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="gpt-4">GPT-4</SelectItem>
                        <SelectItem value="gpt-3.5-turbo">GPT-3.5 Turbo</SelectItem>
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
                      <Input type="number" step="0.01" min={0} max={2} {...field} />
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
          </div>

          {/* Feature Toggles */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium">Features</h3>
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
          </div>

          {submitError && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md">
              {submitError}
            </div>
          )}
          
          <Button type="submit" className="w-full" disabled={submitting}>
            {submitting ? "Adding Project..." : "Add Project"}
          </Button>
        </form>
      </Form>
    </div>
  );
} 
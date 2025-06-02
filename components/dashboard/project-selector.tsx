"use client";

import { useRouter } from "next/navigation";

interface ProjectSelectorProps {
  projects: { id: string; name: string }[];
  selectedProjectId?: string;
}

export function ProjectSelector({
  projects,
  selectedProjectId,
}: ProjectSelectorProps) {
  const router = useRouter();

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const url = new URL(window.location.href);
    url.searchParams.set("projectId", e.target.value);
    router.push(url.toString());
  };

  return (
    <select
      className="border border-gray-300 rounded-md px-3 py-2 bg-white"
      defaultValue={selectedProjectId}
      onChange={handleChange}
    >
      {projects.map((project) => (
        <option key={project.id} value={project.id}>
          {project.name}
        </option>
      ))}
    </select>
  );
}

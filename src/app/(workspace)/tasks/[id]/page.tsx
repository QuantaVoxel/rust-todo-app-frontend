import { TaskDetailView } from "@/features/tasks/task-inspector";

export default async function TaskDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const taskId = Number(id);

  if (!Number.isFinite(taskId) || taskId <= 0) {
    return (
      <div className="p-8 text-[14px] text-ink-muted">Invalid task ID.</div>
    );
  }

  return <TaskDetailView taskId={taskId} mode="page" />;
}

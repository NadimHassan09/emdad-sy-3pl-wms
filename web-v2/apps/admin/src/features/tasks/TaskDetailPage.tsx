import { TaskExecutionView } from './TaskExecutionView'

/** Task detail and execution share one screen (legacy `/tasks/:id`). */
export function TaskDetailPage() {
  return <TaskExecutionView />
}

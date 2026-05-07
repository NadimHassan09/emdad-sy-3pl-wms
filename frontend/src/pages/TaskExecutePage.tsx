import { Navigate, useParams } from 'react-router-dom';

/** Legacy `/tasks/:id/execute` redirects to canonical task execution URL. */
export function TaskExecutePage() {
  const { id = '' } = useParams<{ id: string }>();
  if (!id) return null;
  return <Navigate to={`/tasks/${id}`} replace />;
}

import { useParams, Navigate } from 'react-router-dom';

/**
 * Redirects /brands/:id to /brand/:id (canonical route)
 */
export function BrandRedirect() {
  const { id } = useParams<{ id: string }>();
  return <Navigate to={`/brand/${id}`} replace />;
}

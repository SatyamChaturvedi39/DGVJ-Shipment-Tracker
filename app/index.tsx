import { Redirect } from 'expo-router';
import { useAuth } from '@/hooks/useAuth';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';

export default function Index() {
  const { isLoading, isAuthenticated, user } = useAuth();

  if (isLoading) {
    return <LoadingSpinner />;
  }

  if (!isAuthenticated || !user) {
    return <Redirect href="/auth/login" />;
  }

  switch (user.role) {
    case 'admin':
      return <Redirect href="/(admin)/dashboard" />;
    case 'employee':
      return <Redirect href="/(employee)/my-jobs" />;
    case 'customer':
      return <Redirect href="/(customer)/my-shipments" />;
    default:
      return <Redirect href="/auth/login" />;
  }
}

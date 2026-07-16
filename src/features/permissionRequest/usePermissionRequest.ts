import { useMutation, useQueryClient } from '@tanstack/react-query';
import { permissionRequestRepo } from '@/data/permissionRequest/permissionRequest.repo';
import type { PermissionRequest } from '@/domain/permissionRequest/schema';

const KEY = 'permissionRequests';

export function useSubmitPermissionRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (request: Omit<PermissionRequest, 'id' | 'createdAt' | 'status'>) =>
      permissionRequestRepo.create(request),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}

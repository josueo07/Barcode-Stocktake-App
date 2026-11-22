import type { UserRole, UserSummary } from '@barcode-stocktake/shared';
import { httpClient } from './httpClient';

export async function listUsers(): Promise<UserSummary[]> {
  return (await httpClient.get<{ users: UserSummary[] }>('/api/users')).users;
}

export async function createUser(input: {
  username: string;
  displayName: string;
  role: UserRole;
  pin: string;
}): Promise<UserSummary> {
  return (await httpClient.post<{ user: UserSummary }>('/api/users', input)).user;
}

export async function updateUser(
  id: number,
  input: { displayName?: string; role?: UserRole; active?: boolean; pin?: string },
): Promise<UserSummary> {
  return (await httpClient.patch<{ user: UserSummary }>(`/api/users/${id}`, input)).user;
}

import type { AuthUser, ProfileStats } from '@barcode-stocktake/shared';
import { httpClient } from './httpClient';

export async function renameMe(displayName: string): Promise<AuthUser> {
  return (await httpClient.patch<{ user: AuthUser }>('/api/auth/me', { displayName })).user;
}

export async function changeMyPin(currentPin: string, newPin: string): Promise<void> {
  await httpClient.post('/api/auth/me/pin', { currentPin, newPin });
}

export async function getMyStats(): Promise<ProfileStats> {
  return (await httpClient.get<{ stats: ProfileStats }>('/api/auth/me/stats')).stats;
}

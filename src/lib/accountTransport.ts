import { validAccount, type AccountData } from './accountData';

export interface Envelope { data: AccountData; revision: string | null; updatedAt: string | null; userId: string }
interface Session { userId: string | null; generation: number }
const sessionError = () => Object.assign(new Error('La session a changé. Reconnectez-vous.'), { status: 401 });

// Bind every request to its starting session, including the await used to refresh it.
// The server also compares the expected owner with the verified Identity session.
export function accountTransport(session: () => Session, refresh: () => Promise<unknown>, send: typeof fetch = fetch) {
  return async (method = 'GET', body?: unknown): Promise<Envelope> => {
    const owner = session();
    if (!owner.userId) throw sessionError();
    const unchanged = () => session().userId === owner.userId && session().generation === owner.generation;
    await refresh();
    if (!unchanged()) throw sessionError();
    const response = await send('/.netlify/functions/account', {
      method, credentials: 'same-origin', cache: 'no-store',
      headers: { 'Content-Type': 'application/json', 'X-Account-Id': owner.userId },
      body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(15000),
    });
    if (!unchanged()) throw sessionError();
    if (!response.headers.get('content-type')?.includes('application/json')) {
      throw new Error('Le service de sauvegarde est indisponible sur ce site. Vos données n’ont pas été confirmées par le serveur.');
    }
    const result = await response.json();
    if (!unchanged()) throw sessionError();
    if (!response.ok) throw Object.assign(new Error(result?.error || 'Service indisponible.'), { status: response.status });
    if (result?.userId !== owner.userId) throw sessionError();
    if ((result.revision !== null && (typeof result.revision !== 'string' || !result.revision)) ||
        (result.updatedAt !== null && (typeof result.updatedAt !== 'string' || !Number.isFinite(Date.parse(result.updatedAt)))) ||
        (method === 'GET' && !validAccount(result.data)) ||
        (method !== 'GET' && (!result.revision || !result.updatedAt))) {
      throw new Error('La réponse de sauvegarde est invalide. Vos modifications locales sont conservées.');
    }
    return result;
  };
}

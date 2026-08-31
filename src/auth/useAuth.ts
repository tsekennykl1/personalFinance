import { fetchAuthSession, signIn, signOut, getCurrentUser } from 'aws-amplify/auth';

export async function getAccessToken(): Promise<string | null> {
  try {
    const session = await fetchAuthSession();
    return session.tokens?.accessToken?.toString() ?? null;
  } catch {
    return null;
  }
}

export async function login(email: string, password: string) {
  return signIn({ username: email, password });
}

export async function logout() {
  return signOut();
}

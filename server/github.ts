import { ReplitConnectors } from "@replit/connectors-sdk";

// GitHub connector — uses Replit's OAuth proxy for authenticated API requests.
// Never cache the connectors instance; tokens expire and must be refreshed per request.

export async function githubRequest(path: string, options: { method?: string; body?: unknown } = {}) {
  const connectors = new ReplitConnectors();
  const response = await connectors.proxy("github", path, {
    method: options.method ?? "GET",
    ...(options.body ? { body: JSON.stringify(options.body) } : {}),
  });
  return response.json();
}

export async function getAuthenticatedUser() {
  return githubRequest("/user");
}

export async function getUserRepos() {
  return githubRequest("/user/repos?sort=updated&per_page=30");
}

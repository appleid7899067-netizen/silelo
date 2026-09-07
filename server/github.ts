const GITHUB_API = "https://api.github.com";
const DEFAULT_REPOSITORY = "phanuphanthcanthrsngsaeng17-del/silelo-neo-connect";
type GithubPermission = { read: boolean; write: boolean; error?: string };
let permissionCache: { expiresAt: number; value: GithubPermission } | undefined;

function githubHeaders() {
  const token = process.env.GITHUB_TOKEN;
  if (!token) throw new Error("GITHUB_NOT_CONFIGURED");
  return { Accept: "application/vnd.github+json", Authorization: `Bearer ${token}`, "X-GitHub-Api-Version": "2022-11-28", "User-Agent": "silelo-manus-app" };
}

function normalizeRepo(repo: string) {
  const normalized = repo.trim().replace(/^https?:\/\/github\.com\//, "").replace(/\.git$/, "").replace(/^\/+|\/+$/g, "");
  if (!/^[^/]+\/[^/]+$/.test(normalized)) throw new Error("GITHUB_REPOSITORY_FORMAT");
  return normalized;
}

export function allowedGithubRepositories() {
  return (process.env.GITHUB_ALLOWED_REPOS || DEFAULT_REPOSITORY).split(",").map(repo => normalizeRepo(repo)).filter(Boolean);
}

function assertAllowedRepository(repo: string) {
  const normalized = normalizeRepo(repo);
  if (!allowedGithubRepositories().includes(normalized)) throw new Error("GITHUB_REPOSITORY_NOT_ALLOWED");
  return normalized;
}

export async function githubPermissionStatus(): Promise<GithubPermission> {
  if (permissionCache && permissionCache.expiresAt > Date.now()) return permissionCache.value;
  const target = allowedGithubRepositories()[0];
  if (!process.env.GITHUB_TOKEN) return { read: false, write: false, error: "GITHUB_NOT_CONFIGURED" };
  try {
    const response = await fetch(`${GITHUB_API}/repos/${target}`, { headers: githubHeaders() });
    if (!response.ok) throw new Error(`GITHUB_${response.status}`);
    const data = await response.json() as { permissions?: { pull?: boolean; push?: boolean } };
    const value = { read: data.permissions?.pull !== false, write: data.permissions?.push === true };
    permissionCache = { expiresAt: Date.now() + 60_000, value };
    return value;
  } catch (error) {
    const value = { read: false, write: false, error: error instanceof Error ? error.message : "GITHUB_PERMISSION_CHECK_FAILED" };
    permissionCache = { expiresAt: Date.now() + 10_000, value };
    return value;
  }
}

export async function getGithubRepository(repo: string) {
  const normalized = assertAllowedRepository(repo);
  const response = await fetch(`${GITHUB_API}/repos/${normalized}`, { headers: githubHeaders() });
  if (!response.ok) throw new Error(`GITHUB_${response.status}`);
  const data = await response.json() as Record<string, unknown>;
  return { fullName: data.full_name, description: data.description, private: data.private, defaultBranch: data.default_branch, htmlUrl: data.html_url, openIssues: data.open_issues_count, updatedAt: data.updated_at };
}

export async function updateGithubFile(repo: string, filePath: string, content: string, message: string) {
  const normalized = assertAllowedRepository(repo);
  const safePath = filePath.trim().replace(/^\/+/, "");
  if (!safePath || safePath.includes("..")) throw new Error("GITHUB_FILE_PATH_INVALID");
  const currentResponse = await fetch(`${GITHUB_API}/repos/${normalized}/contents/${safePath}`, { headers: githubHeaders() });
  if (!currentResponse.ok) throw new Error(`GITHUB_READ_${currentResponse.status}`);
  const current = await currentResponse.json() as { sha?: string };
  if (!current.sha) throw new Error("GITHUB_FILE_SHA_MISSING");
  const response = await fetch(`${GITHUB_API}/repos/${normalized}/contents/${safePath}`, { method: "PUT", headers: { ...githubHeaders(), "Content-Type": "application/json" }, body: JSON.stringify({ message: message.trim().slice(0, 200) || `Update ${safePath}`, content: Buffer.from(content, "utf8").toString("base64"), sha: current.sha }) });
  if (!response.ok) throw new Error(`GITHUB_WRITE_${response.status}`);
  const data = await response.json() as { commit?: { sha?: string; html_url?: string } };
  return { commitSha: data.commit?.sha, commitUrl: data.commit?.html_url, path: safePath, repository: normalized };
}

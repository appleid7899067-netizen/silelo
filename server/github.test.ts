import { describe, expect, it } from "vitest";
import { getGithubRepository } from "./github";

describe("GitHub integration credential", () => {
  it("authenticates against GitHub with the server-side token", async () => {
    const token = process.env.GITHUB_TOKEN;
    expect(token, "GITHUB_TOKEN must be configured for the real GitHub integration").toBeTruthy();

    const response = await fetch("https://api.github.com/user", {
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${token}`,
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "silelo-manus-app",
      },
    });

    expect(response.status, await response.text()).toBe(200);
  }, 15_000);

  it("reads the configured source repository metadata", async () => {
    const repository = await getGithubRepository("phanuphanthcanthrsngsaeng17-del/silelo-neo-connect");
    expect(repository.fullName).toBe("phanuphanthcanthrsngsaeng17-del/silelo-neo-connect");
    expect(repository.defaultBranch).toBeTruthy();
  }, 15_000);
});

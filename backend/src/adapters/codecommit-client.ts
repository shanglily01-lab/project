// ─── CodeCommit read-only client ──────────────────────
// Thin wrapper over the AWS SDK exposing ONLY read operations — no write /
// merge / delete methods exist here by design (read-only posture).
// Pairs with the pure parsers in codecommit-adapter.ts.

import {
  CodeCommitClient,
  ListRepositoriesCommand,
  GetBranchCommand,
  GetRepositoryCommand,
  GetCommitCommand,
  BatchGetCommitsCommand,
  GetDifferencesCommand,
  GetBlobCommand,
} from '@aws-sdk/client-codecommit';

const REGION = process.env.AWS_REGION || 'us-east-1';

export class CodeCommitReadClient {
  private client: CodeCommitClient;

  constructor(region: string = REGION) {
    // Prefer explicit static keys (the `git` IAM user) from env/.env; otherwise
    // fall back to the default AWS chain (SSO profile).
    const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
    const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
    this.client = new CodeCommitClient({
      region,
      ...(accessKeyId && secretAccessKey ? { credentials: { accessKeyId, secretAccessKey } } : {}),
    });
  }

  async listRepositories(): Promise<string[]> {
    const names: string[] = [];
    let nextToken: string | undefined;
    do {
      const out = await this.client.send(new ListRepositoriesCommand({ nextToken }));
      for (const r of out.repositories ?? []) if (r.repositoryName) names.push(r.repositoryName);
      nextToken = out.nextToken;
    } while (nextToken);
    return names.sort();
  }

  async getDefaultBranchCommit(repo: string): Promise<string | null> {
    const meta = await this.client.send(new GetRepositoryCommand({ repositoryName: repo }));
    const branch = meta.repositoryMetadata?.defaultBranch;
    if (!branch) return null;
    const b = await this.client.send(new GetBranchCommand({ repositoryName: repo, branchName: branch }));
    return b.branch?.commitId ?? null;
  }

  async getCommit(repo: string, commitId: string) {
    const out = await this.client.send(new GetCommitCommand({ repositoryName: repo, commitId }));
    return out.commit;
  }

  async batchGetCommits(repo: string, commitIds: string[]) {
    if (commitIds.length === 0) return [];
    const out = await this.client.send(new BatchGetCommitsCommand({ repositoryName: repo, commitIds }));
    return out.commits ?? [];
  }

  /** File-level changes between two commits (paginated). */
  async getDifferences(repo: string, beforeCommitId: string | undefined, afterCommitId: string) {
    const diffs = [];
    let nextToken: string | undefined;
    do {
      const out = await this.client.send(
        new GetDifferencesCommand({ repositoryName: repo, beforeCommitSpecifier: beforeCommitId, afterCommitSpecifier: afterCommitId, NextToken: nextToken }),
      );
      diffs.push(...(out.differences ?? []));
      nextToken = out.NextToken;
    } while (nextToken);
    return diffs;
  }

  async getBlob(repo: string, blobId: string): Promise<string> {
    const out = await this.client.send(new GetBlobCommand({ repositoryName: repo, blobId }));
    return out.content ? Buffer.from(out.content).toString('utf8') : '';
  }
}

# How changes reach `main`

## The rules

1. Every feature gets its own branch, made from `main`.
2. Tests are written **first** and fail, then the code makes them pass (test-driven development).
3. Claude commits and pushes the branch. **Only you merge it into `main`.**
4. A branch is ready to merge only when GitHub shows a green check ✅ for CI.

Branch names: `setup/...`, `feature/...`, `fix/...`, `docs/...`

## How to merge a branch (on GitHub)

**Step 1 of 6.** Go to **https://github.com/freshcuesl/crusty_kusty**

**Step 2 of 6.** GitHub usually shows a yellow bar: **"setup/project-foundation had recent
pushes"**. Click **Compare & pull request**.

> No yellow bar? Click the **Pull requests** tab, click **New pull request**, set
> **compare:** to the branch name, then click **Create pull request**.

**Step 3 of 6.** Click **Create pull request**.

**Step 4 of 6.** Wait for the checks at the bottom to finish.

✅ **You should see:** **"All checks have passed"** with a green check.

> A red ❌? Don't merge. Tell Claude the branch name and it will fix it.

**Step 5 of 6.** Click **Merge pull request**, then **Confirm merge**.

**Step 6 of 6.** Click **Delete branch**. This is safe: the work is now in `main`.

## Recommended one-time setting: protect `main`

This makes GitHub refuse any merge whose checks are red.

1. In the repo, click **Settings** (top right of the repo page).
2. In the left menu, click **Branches**.
3. Click **Add branch ruleset** (or **Add rule**).
4. Name it `main`, set **Target branches** to include the default branch.
5. Turn on **Require a pull request before merging** and **Require status checks to pass**.
   Add the checks named **Lint, types, unit tests**, **End-to-end (Playwright)** and
   **Database tests (pgTAP)**.
6. Click **Create** (or **Save changes**).

## Useful commands

| Command              | What it does                                                    |
| -------------------- | --------------------------------------------------------------- |
| `npm run check`      | Lint, types, formatting and unit tests, the same checks CI runs |
| `npm run test:watch` | Re-runs unit tests every time you save                          |
| `npm run test:e2e`   | Opens the app in real browsers and tests it                     |
| `npm run db:test`    | Runs database security tests (database must be running)         |

import assert from "node:assert/strict";
import test from "node:test";
import { syncMicrosoftStore } from "./microsoft-store.js";

function setup(testContext, options = {}) {
  const tag = options.tag ?? "v2.1.0";
  const mirrorUrl = `https://openlist.frameneo.com/sd/mt_store/${tag}/MAD.Toolbox_${tag.slice(1)}_x64-setup.exe`;
  const release = {
    id: 21,
    tag_name: tag,
    draft: false,
    prerelease: false,
    body: "## Downloads\n\n| Windows x64 | [Setup.exe](https://example.com/setup.exe) |\n\n- feat: 依赖镜像安装\n- fix: 下载进度显示",
    assets: [
      { name: `MAD.Toolbox_${tag.slice(1)}_x64-setup.exe`, size: 5000 },
      { name: `MAD.Toolbox_${tag.slice(1)}_x64-setup.exe.sig`, size: 424 }
    ]
  };
  const releases = options.releases ?? [release];
  const releaseUpdates = [];
  let failPromotion = options.failPromotion;
  const packages = [
    {
      packageId: "windows-package",
      packageUrl: options.untrackedPackage
        ? mirrorUrl
        : "https://openlist.frameneo.com/sd/mt/old.exe",
      packageType: "exe",
      architectures: ["X64"],
      languages: ["zh-cn", "en-us"],
      installerParameters: "/S",
      isSilentInstall: false,
      errorDetails: []
    }
  ];
  let record = options.record ?? null;
  let moduleReady = true;
  const submissions = [];
  const updates = [];
  const listings = [
    { language: "zh-cn", description: "手动保存的应用描述", whatsNew: "旧版说明" },
    { language: "en-us", description: "Manually saved description", whatsNew: "Old notes" }
  ];
  const metadataUpdates = [];
  const warnings = [];
  let failRecordUpload = options.failRecordUpload;
  const secrets = {
    STORE_APP_ID: "application-id",
    STORE_SELLER_ID: "seller-id",
    STORE_TENANT_ID: "tenant-id",
    STORE_CLIENT_ID: "client-id",
    STORE_CLIENT_SECRET: "client-secret"
  };
  testContext.mock.method(globalThis, "fetch", async (url, request = {}) => {
    const address = new URL(url);
    if (address.hostname === "openlist.frameneo.com") {
      assert.equal(url, mirrorUrl);
      assert.equal(request.method, "HEAD");
      if (options.mirrorMissing) return new Response("", { status: 500 });
      return new Response(null, {
        headers: {
          "Content-Type": options.mirrorHtml ? "text/html" : "application/octet-stream",
          "Content-Length": "5000"
        }
      });
    }
    if (address.hostname === "login.microsoftonline.com") {
      const form = new URLSearchParams(request.body);
      assert.equal(form.get("client_secret"), "client-secret");
      assert.equal(form.get("scope"), "https://api.store.microsoft.com/.default");
      return Response.json({ access_token: "access-token" });
    }
    assert.equal(address.hostname, "api.store.microsoft.com");
    assert.equal(request.headers.Authorization, "Bearer access-token");
    assert.equal(request.headers["X-Seller-Account-Id"], "seller-id");
    let data;
    if (address.pathname.endsWith("/submission/submission-id/status")) {
      if (options.submissionStatusError) {
        if (options.submissionStatusHtml) {
          return new Response("<html>Service unavailable</html>", {
            status: options.submissionStatusError
          });
        }
        return Response.json(
          {
            isSuccess: false,
            errors: [
              {
                code: "submissionerror",
                message: "Unable to Get Submission Status",
                target: "submission"
              }
            ]
          },
          { status: options.submissionStatusError }
        );
      }
      data = {
        publishingStatus: options.publishingStatus ?? "INPROGRESS",
        hasFailed: options.publishingStatus === "FAILED"
      };
    } else if (address.pathname.endsWith("/status")) {
      if (options.moduleStatusError) {
        return Response.json(
          { isSuccess: false, errors: [] },
          { status: options.moduleStatusError }
        );
      }
      data = {
        isReady: moduleReady,
        ongoingSubmissionId: submissions.length ? "submission-id" : ""
      };
    } else if (address.pathname.endsWith("/metadata/listings")) {
      data = { listings };
    } else if (address.pathname.endsWith("/metadata")) {
      assert.equal(request.method, "PATCH");
      assert.equal(moduleReady, true);
      const update = JSON.parse(request.body);
      metadataUpdates.push(update);
      Object.assign(
        listings.find((listing) => listing.language === update.listings.language),
        update.listings
      );
      moduleReady = !options.metadataPending;
      data = {};
    } else if (address.pathname.endsWith("/packages/windows-package")) {
      assert.equal(request.method, "PATCH");
      const update = JSON.parse(request.body);
      updates.push(update);
      Object.assign(packages[0], update);
      data = {};
    } else if (address.pathname.endsWith("/packages/commit")) {
      assert.equal(request.method, "POST");
      moduleReady = !options.uploadPending;
      data = {};
    } else if (address.pathname.endsWith("/packages")) {
      data = { packages };
    } else if (address.pathname.endsWith("/submit")) {
      assert.equal(request.method, "POST");
      if (options.submitError) {
        return Response.json({ isSuccess: false, errors: [] }, { status: options.submitError });
      }
      submissions.push(structuredClone(packages));
      data = { submissionId: "submission-id" };
    } else {
      assert.fail(`Unexpected request: ${url}`);
    }
    return Response.json({ isSuccess: true, errors: [], responseData: data });
  });
  const github = {
    paginate: async (method, parameters) => (await method(parameters)).data,
    rest: {
      repos: {
        listReleases: async () => ({ data: releases }),
        updateRelease: async (parameters) => {
          if (failPromotion) {
            failPromotion = false;
            throw new Error("GitHub promotion failed");
          }
          assert.equal(parameters.owner, "MAD-Producer");
          assert.equal(parameters.repo, "MAD-Toolbox");
          assert.equal(parameters.release_id, 21);
          releaseUpdates.push(parameters);
          release.prerelease = parameters.prerelease;
          return { data: release };
        },
        listReleaseAssets: async () => ({
          data: record ? [{ id: 99, name: "microsoft-store-submission.json" }] : []
        }),
        getReleaseAsset: async () => ({
          data: options.assetStream
            ? new Response(JSON.stringify(record)).body
            : Buffer.from(JSON.stringify(record))
        }),
        deleteReleaseAsset: async () => {
          record = null;
        },
        uploadReleaseAsset: async ({ data }) => {
          if (failRecordUpload && JSON.parse(data.toString()).submissionId) {
            failRecordUpload = false;
            throw new Error("GitHub upload failed");
          }
          record = JSON.parse(data.toString());
          return { data: { id: 99 } };
        }
      }
    }
  };
  const core = {
    info() {},
    warning(message) {
      warnings.push(message);
    },
    setSecret() {},
    summary: {
      addRaw() {
        return this;
      },
      async write() {}
    }
  };
  const run = (inputs = {}) =>
    syncMicrosoftStore({
      github,
      core,
      context: { repo: { owner: "MAD-Producer", repo: "MAD-Toolbox" } },
      env: { ...secrets, ...inputs }
    });
  return {
    run,
    submissions,
    updates,
    listings,
    metadataUpdates,
    warnings,
    release,
    releases,
    releaseUpdates,
    getRecord: () => record,
    finishUpload: () => {
      moduleReady = true;
    }
  };
}

test("submits a prerelease without promoting it before Store publication", async (testContext) => {
  const fixture = setup(testContext);
  fixture.release.prerelease = true;
  assert.equal((await fixture.run()).outcome, "submitted");
  assert.equal((await fixture.run()).outcome, "in-progress");
  assert.equal(fixture.release.prerelease, true);
  assert.deepEqual(fixture.releaseUpdates, []);
  assert.equal(fixture.submissions.length, 1);
});

test("selects the highest stable version tag while ignoring nightly and draft releases", async (testContext) => {
  const fixture = setup(testContext);
  fixture.release.prerelease = true;
  fixture.releases.unshift(
    { ...fixture.release, tag_name: "nightly" },
    { ...fixture.release, tag_name: "v3.0.0", draft: true },
    { ...fixture.release, tag_name: "v2.2.0-beta.1" },
    { ...fixture.release, tag_name: "v2.0.99", prerelease: false }
  );
  const result = await fixture.run();
  assert.equal(result.outcome, "submitted");
  assert.equal(result.tag, "v2.1.0");
});

test("compares version components numerically rather than by release order", async (testContext) => {
  const fixture = setup(testContext, { tag: "v2.10.0" });
  fixture.release.prerelease = true;
  fixture.releases.unshift({ ...fixture.release, tag_name: "v2.9.0", prerelease: false });
  const result = await fixture.run();
  assert.equal(result.outcome, "submitted");
  assert.equal(result.tag, "v2.10.0");
  assert.equal(
    fixture.submissions[0][0].packageUrl,
    "https://openlist.frameneo.com/sd/mt_store/v2.10.0/MAD.Toolbox_2.10.0_x64-setup.exe"
  );
});

test("skips when there are no published versioned releases", async (testContext) => {
  const fixture = setup(testContext, { releases: [] });
  assert.equal((await fixture.run()).outcome, "ineligible-release");
  assert.deepEqual(fixture.submissions, []);
});

test("promotes a prerelease to latest only after confirmed Store publication", async (testContext) => {
  const fixture = setup(testContext, { publishingStatus: "PUBLISHED" });
  fixture.release.prerelease = true;
  await fixture.run();
  assert.equal((await fixture.run()).outcome, "published");
  assert.equal(fixture.getRecord().publishingStatus, "PUBLISHED");
  assert.equal(fixture.release.prerelease, false);
  assert.deepEqual(fixture.releaseUpdates, [
    {
      owner: "MAD-Producer",
      repo: "MAD-Toolbox",
      release_id: 21,
      prerelease: false,
      make_latest: "true"
    }
  ]);
  await fixture.run();
  assert.equal(fixture.releaseUpdates.length, 1);
  assert.equal(fixture.submissions.length, 1);
});

test("dry run does not promote a Store-published prerelease", async (testContext) => {
  const fixture = setup(testContext, { publishingStatus: "PUBLISHED" });
  fixture.release.prerelease = true;
  await fixture.run();
  const record = structuredClone(fixture.getRecord());
  assert.equal((await fixture.run({ DRY_RUN: "true" })).outcome, "dry-run");
  assert.equal(fixture.release.prerelease, true);
  assert.deepEqual(fixture.releaseUpdates, []);
  assert.deepEqual(fixture.getRecord(), record);
});

test("retries GitHub promotion from a saved published status without resubmitting", async (testContext) => {
  const options = { publishingStatus: "PUBLISHED", failPromotion: true };
  const fixture = setup(testContext, options);
  fixture.release.prerelease = true;
  await fixture.run();
  await assert.rejects(fixture.run(), /GitHub promotion failed/);
  assert.equal(fixture.getRecord().publishingStatus, "PUBLISHED");
  options.moduleStatusError = 500;
  options.submissionStatusError = 500;
  assert.equal((await fixture.run()).outcome, "published");
  assert.equal(fixture.release.prerelease, false);
  assert.equal(fixture.submissions.length, 1);
});

test("unavailable Store status does not promote a prerelease", async (testContext) => {
  const fixture = setup(testContext, { submissionStatusError: 500 });
  fixture.release.prerelease = true;
  await fixture.run();
  assert.equal((await fixture.run()).outcome, "status-unavailable");
  assert.equal(fixture.release.prerelease, true);
  assert.deepEqual(fixture.releaseUpdates, []);
});

test("rejected Store submissions leave the GitHub release as a prerelease", async (testContext) => {
  const fixture = setup(testContext, { publishingStatus: "FAILED" });
  fixture.release.prerelease = true;
  await fixture.run();
  await assert.rejects(fixture.run(), /failed/i);
  assert.equal(fixture.release.prerelease, true);
  assert.deepEqual(fixture.releaseUpdates, []);
});

test("waits for an unsynchronized mirror without changing the Store", async (testContext) => {
  const fixture = setup(testContext, { mirrorMissing: true });
  const result = await fixture.run();
  assert.equal(result.outcome, "mirror-pending");
  assert.deepEqual(fixture.submissions, []);
  assert.deepEqual(fixture.updates, []);
  assert.equal(fixture.getRecord(), null);
});

test("does not submit an HTML error page returned with HTTP 200", async (testContext) => {
  const fixture = setup(testContext, { mirrorHtml: true });
  assert.equal((await fixture.run()).outcome, "mirror-pending");
  assert.deepEqual(fixture.submissions, []);
});

test("submits the versioned mirror URL and preserves installer settings", async (testContext) => {
  const fixture = setup(testContext);
  assert.equal((await fixture.run()).outcome, "submitted");
  assert.equal(fixture.submissions.length, 1);
  assert.deepEqual(fixture.submissions[0][0], {
    packageId: "windows-package",
    packageUrl: "https://openlist.frameneo.com/sd/mt_store/v2.1.0/MAD.Toolbox_2.1.0_x64-setup.exe",
    packageType: "exe",
    architectures: ["X64"],
    languages: ["zh-cn", "en-us"],
    installerParameters: "/S",
    isSilentInstall: false,
    errorDetails: []
  });
  assert.equal(fixture.getRecord().submissionId, "submission-id");
});

test("checks an existing submission instead of submitting it again", async (testContext) => {
  const fixture = setup(testContext);
  await fixture.run();
  assert.equal((await fixture.run()).outcome, "in-progress");
  assert.equal(fixture.submissions.length, 1);
});

test("resumes a prepared package after upload processing finishes", async (testContext) => {
  const fixture = setup(testContext, { uploadPending: true });
  assert.equal((await fixture.run()).outcome, "upload-pending");
  assert.equal(fixture.getRecord().submissionId, null);
  assert.deepEqual(fixture.submissions, []);
  fixture.finishUpload();
  assert.equal((await fixture.run()).outcome, "submitted");
  assert.equal(fixture.updates.length, 1);
  assert.equal(fixture.submissions.length, 1);
});

test("dry run does not mutate Store packages or release assets", async (testContext) => {
  const fixture = setup(testContext);
  assert.equal((await fixture.run({ DRY_RUN: "true" })).outcome, "dry-run");
  assert.deepEqual(fixture.updates, []);
  assert.deepEqual(fixture.metadataUpdates, []);
  assert.deepEqual(fixture.submissions, []);
  assert.equal(fixture.getRecord(), null);
});

test("reports a rejected submission without automatically resubmitting", async (testContext) => {
  const fixture = setup(testContext, { publishingStatus: "FAILED" });
  await fixture.run();
  await assert.rejects(fixture.run(), /failed/i);
  assert.equal(fixture.submissions.length, 1);
});

test("skips releases without the unified Windows installer", async (testContext) => {
  const fixture = setup(testContext);
  fixture.release.assets = [{ name: "MAD.Toolbox_2.0.0_x64-Lite-setup.exe", size: 5000 }];
  assert.equal((await fixture.run()).outcome, "no-installer");
  assert.deepEqual(fixture.submissions, []);
});

test("does not submit a version already published in the Store", async (testContext) => {
  const options = { publishingStatus: "PUBLISHED" };
  const fixture = setup(testContext, options);
  await fixture.run();
  assert.equal((await fixture.run()).outcome, "published");
  assert.equal(fixture.getRecord().publishingStatus, "PUBLISHED");
  options.moduleStatusError = 500;
  options.submissionStatusError = 500;
  assert.equal((await fixture.run()).outcome, "published");
  assert.equal(fixture.submissions.length, 1);
});

test("defers an unavailable submission status without changing or resubmitting the draft", async (testContext) => {
  const fixture = setup(testContext, { submissionStatusError: 500 });
  await fixture.run();
  const record = structuredClone(fixture.getRecord());
  assert.equal((await fixture.run({ RETRY_FAILED: "true" })).outcome, "status-unavailable");
  assert.deepEqual(fixture.getRecord(), record);
  assert.equal(fixture.submissions.length, 1);
  assert.equal(fixture.updates.length, 1);
  assert.equal(fixture.metadataUpdates.length, 2);
  assert.match(fixture.warnings[0], /500/);
});

test("defers an HTML server error when reading submission status", async (testContext) => {
  const fixture = setup(testContext, { submissionStatusError: 503, submissionStatusHtml: true });
  await fixture.run();
  assert.equal((await fixture.run()).outcome, "status-unavailable");
  assert.equal(fixture.getRecord().publishingStatus, undefined);
  assert.equal(fixture.submissions.length, 1);
});

test("does not suppress permission errors when reading submission status", async (testContext) => {
  const fixture = setup(testContext, { submissionStatusError: 403 });
  await fixture.run();
  await assert.rejects(fixture.run(), /failed \(403\)/);
  assert.deepEqual(fixture.warnings, []);
  assert.equal(fixture.submissions.length, 1);
});

test("dry run does not persist a published status", async (testContext) => {
  const fixture = setup(testContext, { publishingStatus: "PUBLISHED" });
  await fixture.run();
  const record = structuredClone(fixture.getRecord());
  assert.equal((await fixture.run({ DRY_RUN: "true" })).outcome, "published");
  assert.deepEqual(fixture.getRecord(), record);
});

test("does not suppress a module status server error", async (testContext) => {
  const fixture = setup(testContext, { moduleStatusError: 500 });
  await assert.rejects(fixture.run(), /GET \/status failed \(500\)/);
  assert.deepEqual(fixture.submissions, []);
});

test("does not retry or suppress a submission POST server error", async (testContext) => {
  const fixture = setup(testContext, { submitError: 500 });
  await assert.rejects(fixture.run(), /POST \/submit failed \(500\)/);
  assert.deepEqual(fixture.submissions, []);
  assert.equal(fixture.getRecord().submissionId, null);
});

test("allows an explicitly requested retry of a rejected submission", async (testContext) => {
  const fixture = setup(testContext, { publishingStatus: "FAILED" });
  await fixture.run();
  assert.equal((await fixture.run({ RETRY_FAILED: "true" })).outcome, "submitted");
  assert.equal(fixture.submissions.length, 2);
});

test("recovers a submitted update when saving its release record failed", async (testContext) => {
  const fixture = setup(testContext, { failRecordUpload: true });
  await assert.rejects(fixture.run(), /GitHub upload failed/);
  assert.equal((await fixture.run()).outcome, "in-progress");
  assert.equal(fixture.getRecord()?.submissionId, "submission-id");
  assert.equal(fixture.submissions.length, 1);
});

test("does not duplicate an untracked package already using the target URL", async (testContext) => {
  const fixture = setup(testContext, { untrackedPackage: true });
  assert.equal((await fixture.run()).outcome, "untracked-package");
  assert.equal(fixture.getRecord(), null);
  assert.deepEqual(fixture.submissions, []);
});

test("reads the raw release asset stream returned by Octokit", async (testContext) => {
  const fixture = setup(testContext, { assetStream: true });
  await fixture.run();
  assert.equal((await fixture.run()).outcome, "in-progress");
  assert.equal(fixture.submissions.length, 1);
});

test("updates only whatsNew in existing listing languages using release change items", async (testContext) => {
  const fixture = setup(testContext);
  assert.equal((await fixture.run()).outcome, "submitted");
  const whatsNew = "- feat: 依赖镜像安装\n- fix: 下载进度显示";
  assert.deepEqual(fixture.metadataUpdates, [
    { listings: { language: "zh-cn", whatsNew } },
    { listings: { language: "en-us", whatsNew } }
  ]);
  assert.equal(fixture.listings[0].description, "手动保存的应用描述");
  assert.equal(fixture.listings[1].description, "Manually saved description");
  await fixture.run();
  assert.equal(fixture.metadataUpdates.length, 2);
});

test("preserves existing whatsNew when the release has no change items", async (testContext) => {
  const fixture = setup(testContext);
  fixture.release.body = "## Downloads\n\n| Windows x64 | Setup.exe |";
  assert.equal((await fixture.run()).outcome, "submitted");
  assert.deepEqual(fixture.metadataUpdates, []);
  assert.equal(fixture.listings[0].whatsNew, "旧版说明");
});

test("truncates whatsNew to the Store character limit without blocking submission", async (testContext) => {
  const fixture = setup(testContext);
  fixture.release.body = `- feat: ${"新功能".repeat(600)}`;
  assert.equal((await fixture.run()).outcome, "submitted");
  const notes = fixture.metadataUpdates[0].listings.whatsNew;
  assert.equal(notes.length, 1500);
  assert.ok(notes.endsWith("…"));
});

test("resumes metadata processing without patching an already updated language again", async (testContext) => {
  const fixture = setup(testContext, { metadataPending: true });
  assert.equal((await fixture.run()).outcome, "metadata-pending");
  assert.equal(fixture.metadataUpdates.length, 1);
  assert.deepEqual(fixture.submissions, []);
  fixture.finishUpload();
  assert.equal((await fixture.run()).outcome, "metadata-pending");
  assert.equal(fixture.metadataUpdates.length, 2);
  fixture.finishUpload();
  assert.equal((await fixture.run()).outcome, "submitted");
  assert.equal(fixture.metadataUpdates.length, 2);
  assert.equal(fixture.updates.length, 1);
});

export async function syncMicrosoftStore({ github, context, core, env = process.env }) {
  const repository = context.repo;
  const { data: release } = await github.rest.repos.getLatestRelease(repository);
  const tag = release.tag_name;
  const dryRun = env.DRY_RUN === "true";
  const retryFailed = env.RETRY_FAILED === "true";
  const recordName = "microsoft-store-submission.json";
  let packageUrl;

  async function report(outcome, message) {
    core.info(message);
    await core.summary.addRaw(`Microsoft Store: **${outcome}**\n\n${message}\n`).write();
    return { outcome, tag, packageUrl };
  }

  if (release.draft || release.prerelease || !/^v\d+\.\d+\.\d+$/.test(tag)) {
    return report("ineligible-release", "Only stable vX.Y.Z releases are submitted.");
  }

  const installer = release.assets.find(
    (asset) => asset.name === `MAD.Toolbox_${tag.slice(1)}_x64-setup.exe`
  );
  if (!installer) {
    return report("no-installer", `${tag} has no unified Windows installer; skipping.`);
  }
  packageUrl = `https://openlist.frameneo.com/sd/mt_store/${encodeURIComponent(tag)}/${encodeURIComponent(installer.name)}`;

  for (const name of [
    "STORE_APP_ID",
    "STORE_SELLER_ID",
    "STORE_TENANT_ID",
    "STORE_CLIENT_ID",
    "STORE_CLIENT_SECRET"
  ]) {
    if (!env[name]) throw new Error(`Missing GitHub Actions secret: ${name}`);
  }

  const tokenResponse = await fetch(
    `https://login.microsoftonline.com/${encodeURIComponent(env.STORE_TENANT_ID)}/oauth2/v2.0/token`,
    {
      method: "POST",
      body: new URLSearchParams({
        grant_type: "client_credentials",
        client_id: env.STORE_CLIENT_ID,
        client_secret: env.STORE_CLIENT_SECRET,
        scope: "https://api.store.microsoft.com/.default"
      }),
      signal: AbortSignal.timeout(30000)
    }
  );
  const token = await tokenResponse.json();
  if (!tokenResponse.ok || !token.access_token) {
    throw new Error(
      `Microsoft Store authentication failed: ${token.error_description ?? token.error ?? tokenResponse.status}`
    );
  }
  core.setSecret(token.access_token);

  async function storeRequest(path, method = "GET", body) {
    const response = await fetch(
      `https://api.store.microsoft.com/submission/v1/product/${encodeURIComponent(env.STORE_APP_ID)}${path}`,
      {
        method,
        headers: {
          Authorization: `Bearer ${token.access_token}`,
          "X-Seller-Account-Id": env.STORE_SELLER_ID,
          "Content-Type": "application/json"
        },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: AbortSignal.timeout(30000)
      }
    );
    const payload = await response.json();
    const errors = payload.errors ?? [];
    if (
      !response.ok ||
      !payload.isSuccess ||
      errors.some((error) => error.code === "packageuploaderror")
    ) {
      throw new Error(
        `Microsoft Store ${method} ${path} failed (${response.status}): ${JSON.stringify(errors)}`
      );
    }
    return payload.responseData;
  }

  const { data: assets } = await github.rest.repos.listReleaseAssets({
    ...repository,
    release_id: release.id,
    per_page: 100
  });
  let recordAsset = assets.find((asset) => asset.name === recordName);
  let record = null;
  if (recordAsset) {
    const { data } = await github.rest.repos.getReleaseAsset({
      ...repository,
      asset_id: recordAsset.id,
      headers: { accept: "application/octet-stream" },
      request: { parseSuccessResponseBody: false }
    });
    record = await new Response(data).json();
    if (record.tag !== tag || record.packageUrl !== packageUrl) {
      throw new Error(`The Store submission record does not match ${tag}.`);
    }
  }

  async function saveRecord(submissionId) {
    const nextRecord = {
      tag,
      packageUrl,
      submissionId,
      updatedAt: new Date().toISOString()
    };
    const data = Buffer.from(`${JSON.stringify(nextRecord, null, 2)}\n`);
    if (recordAsset) {
      await github.rest.repos.deleteReleaseAsset({ ...repository, asset_id: recordAsset.id });
    }
    const uploaded = await github.rest.repos.uploadReleaseAsset({
      ...repository,
      release_id: release.id,
      name: recordName,
      data,
      headers: { "content-type": "application/json", "content-length": data.length }
    });
    recordAsset = uploaded.data;
    record = nextRecord;
  }

  let moduleStatus = await storeRequest("/status");
  const submissionId = record?.submissionId || moduleStatus.ongoingSubmissionId;
  if (submissionId) {
    const status = await storeRequest(`/submission/${encodeURIComponent(submissionId)}/status`);
    if (!record?.submissionId) {
      const { packages: activePackages } = await storeRequest("/packages");
      if (activePackages.some((item) => item.packageUrl === packageUrl)) {
        if (dryRun) {
          record = { tag, packageUrl, submissionId };
        } else {
          await saveRecord(submissionId);
        }
      }
    }
    if (status.hasFailed || status.publishingStatus === "FAILED") {
      if (!retryFailed) {
        throw new Error(
          `Store submission ${submissionId} failed. Read the certification report in Partner Center, then use the manual retry_failed option after fixing the cause.`
        );
      }
      record = null;
    } else if (status.publishingStatus === "INPROGRESS" || status.publishingStatus === "UNKNOWN") {
      return report(
        "in-progress",
        `Store submission ${submissionId} is ${status.publishingStatus}; waiting for certification.`
      );
    } else if (status.publishingStatus === "PUBLISHED" && record?.submissionId) {
      return report("published", `${tag} is published in the Microsoft Store.`);
    } else if (status.publishingStatus !== "PUBLISHED") {
      throw new Error(`Unexpected Store submission status: ${JSON.stringify(status)}`);
    }
  }

  let mirror;
  try {
    mirror = await fetch(packageUrl, {
      method: "HEAD",
      redirect: "manual",
      signal: AbortSignal.timeout(30000)
    });
  } catch (error) {
    return report(
      "mirror-pending",
      `Cannot reach ${packageUrl}: ${error.message}. The next scheduled run will check again.`
    );
  }
  const contentType = mirror.headers.get("content-type") ?? "";
  const contentLength = mirror.headers.get("content-length");
  if (
    !mirror.ok ||
    /html|json/i.test(contentType) ||
    (contentLength !== null && Number(contentLength) !== installer.size)
  ) {
    return report(
      "mirror-pending",
      `${packageUrl} is not ready (HTTP ${mirror.status}). The next scheduled run will check again.`
    );
  }

  const { packages } = await storeRequest("/packages");
  const windowsPackages = packages.filter(
    (item) =>
      item.packageType?.toLowerCase() === "exe" &&
      item.architectures?.some((architecture) => architecture.toUpperCase() === "X64")
  );
  if (windowsPackages.length !== 1) {
    throw new Error(
      `Expected one existing Windows x64 EXE package in Partner Center, found ${windowsPackages.length}.`
    );
  }
  const windowsPackage = windowsPackages[0];
  if (!record && windowsPackage.packageUrl === packageUrl && !retryFailed) {
    return report(
      "untracked-package",
      `${tag} already appears in Partner Center without a submission record. Check whether it is published before using the manual retry_failed option; no duplicate submission was created.`
    );
  }
  if (dryRun) {
    return report(
      "dry-run",
      `Would submit ${tag} using ${packageUrl} and update whatsNew from its release change items. No Store draft or release assets were changed.`
    );
  }

  if (!record) {
    if (!moduleStatus.isReady) {
      return report(
        "upload-pending",
        "Partner Center modules are still processing; the next scheduled run will check again."
      );
    }
    if (windowsPackage.packageUrl !== packageUrl) {
      await storeRequest(`/packages/${encodeURIComponent(windowsPackage.packageId)}`, "PATCH", {
        ...windowsPackage,
        packageUrl
      });
    }
    await storeRequest("/packages/commit", "POST");
    await saveRecord(null);
    moduleStatus = await storeRequest("/status");
  } else if (windowsPackage.packageUrl !== packageUrl) {
    throw new Error(
      "The prepared Store package URL was changed. Restore it in Partner Center before continuing."
    );
  }

  if (!moduleStatus.isReady) {
    return report(
      "upload-pending",
      `${tag} is prepared, but package processing has not finished. The next scheduled run will resume submission.`
    );
  }
  const changeItems = (release.body ?? "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => /^[-*]\s+/.test(line))
    .join("\n");
  const whatsNew =
    changeItems.length > 1500
      ? `${changeItems.slice(0, 1499).replace(/[\uD800-\uDBFF]$/, "")}…`
      : changeItems;
  if (whatsNew) {
    const { listings } = await storeRequest("/metadata/listings");
    for (const listing of listings) {
      if (listing.whatsNew === whatsNew) continue;
      await storeRequest("/metadata", "PATCH", {
        listings: { language: listing.language, whatsNew }
      });
      moduleStatus = await storeRequest("/status");
      if (!moduleStatus.isReady) {
        return report(
          "metadata-pending",
          `${tag} release notes are being processed. The next scheduled run will resume submission.`
        );
      }
    }
  } else {
    core.info("No release change items found; existing whatsNew is preserved.");
  }
  const submitted = await storeRequest("/submit", "POST");
  if (!submitted.submissionId) {
    throw new Error(
      "Microsoft Store accepted the request without returning a submission ID; inspect Partner Center before retrying."
    );
  }
  await saveRecord(submitted.submissionId);
  return report(
    "submitted",
    `Submitted ${tag} for certification (submission ${submitted.submissionId}). This does not mean the update is already live.`
  );
}

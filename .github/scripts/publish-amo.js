#!/usr/bin/env node
/**
 * Publish Firefox extension update to addons.mozilla.org (AMO)
 * using the AMO Version Create API (API v5).
 *
 * Target: https://addons.mozilla.org/en-US/firefox/addon/connectify/
 *
 * Workflow:
 * 1. Generates HS256 JWT using AMO API Key (Issuer) and API Secret.
 * 2. Uploads packaged .xpi file to POST /api/v5/addons/upload/
 * 3. Polls GET /api/v5/addons/upload/<uuid>/ until processed and validated.
 * 4. Calls Version Create API: POST /api/v5/addons/addon/<slug>/versions/
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const AMO_API_BASE = 'https://addons.mozilla.org/api/v5';

/**
 * Generate a short-lived HS256 JWT for authenticating with the AMO API.
 */
function generateJwt(issuer, secret) {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const now = Math.floor(Date.now() / 1000);
  const payload = Buffer.from(JSON.stringify({
    iss: issuer,
    jti: crypto.randomBytes(16).toString('hex'),
    iat: now,
    exp: now + 300 // 5 minutes validity
  })).toString('base64url');

  const signature = crypto.createHmac('sha256', secret)
    .update(`${header}.${payload}`)
    .digest('base64url');

  return `${header}.${payload}.${signature}`;
}

/**
 * Sleep helper.
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Main publish function.
 */
async function publishToAmo() {
  const issuer = process.env.AMO_JWT_ISSUER || process.env.AMO_API_KEY;
  const secret = process.env.AMO_JWT_SECRET || process.env.AMO_API_SECRET;
  const addonSlug = process.env.AMO_ADDON_SLUG || process.env.AMO_EXTENSION_ID || 'connectify';
  const channel = process.env.AMO_CHANNEL || 'listed';

  if (!issuer || !secret) {
    console.warn('⚠️ AMO credentials (AMO_JWT_ISSUER / AMO_JWT_SECRET or AMO_API_KEY / AMO_API_SECRET) not set.');
    console.warn('Skipping AMO Version Create upload. To enable automatic AMO publishing, add these secrets to your repository.');
    process.exit(0);
  }

  // Determine XPI file path
  let xpiPath = process.argv[2];
  if (!xpiPath) {
    const files = fs.readdirSync('.').filter(f => f.startsWith('connectify-') && f.endsWith('.xpi'));
    if (files.length > 0) {
      xpiPath = files[0];
    }
  }

  if (!xpiPath || !fs.existsSync(xpiPath)) {
    console.error(`❌ XPI file not found: ${xpiPath || '(none specified)'}`);
    process.exit(1);
  }

  const xpiFilename = path.basename(xpiPath);
  const xpiBuffer = fs.readFileSync(xpiPath);
  console.log(`📦 Found package: ${xpiFilename} (${(xpiBuffer.length / 1024).toFixed(1)} KB)`);
  console.log(`🎯 Target AMO Add-on: ${addonSlug} (${channel} channel)`);

  // Step 1: Upload package to /api/v5/addons/upload/
  console.log('\n[1/3] Uploading package to AMO Upload Create API...');
  const formData = new FormData();
  formData.append('upload', new Blob([xpiBuffer], { type: 'application/octet-stream' }), xpiFilename);
  formData.append('channel', channel);

  let uploadResponse = await fetch(`${AMO_API_BASE}/addons/upload/`, {
    method: 'POST',
    headers: {
      'Authorization': `JWT ${generateJwt(issuer, secret)}`,
      'Accept': 'application/json'
    },
    body: formData
  });

  if (!uploadResponse.ok) {
    const errText = await uploadResponse.text();
    console.error(`❌ Upload failed (HTTP ${uploadResponse.status}): ${errText}`);
    process.exit(1);
  }

  const uploadData = await uploadResponse.json();
  const uploadUuid = uploadData.uuid;
  console.log(`✓ Package uploaded successfully. Upload UUID: ${uploadUuid}`);

  // Step 2: Poll upload validation status
  console.log('\n[2/3] Waiting for AMO validator to process upload...');
  const maxAttempts = 60; // 60 * 5s = 5 minutes max
  let attempts = 0;
  let validationResult = null;

  while (attempts < maxAttempts) {
    attempts++;
    await sleep(5000);

    const pollResponse = await fetch(`${AMO_API_BASE}/addons/upload/${uploadUuid}/`, {
      method: 'GET',
      headers: {
        'Authorization': `JWT ${generateJwt(issuer, secret)}`,
        'Accept': 'application/json'
      }
    });

    if (!pollResponse.ok) {
      const errText = await pollResponse.text();
      console.warn(`⚠️ Polling error (HTTP ${pollResponse.status}): ${errText}. Retrying...`);
      continue;
    }

    validationResult = await pollResponse.json();

    if (validationResult.processed) {
      break;
    }

    process.stdout.write(`  ... still validating (attempt ${attempts}/${maxAttempts})\r`);
  }

  console.log('');

  if (!validationResult || !validationResult.processed) {
    console.error('❌ Validation timed out after 5 minutes.');
    process.exit(1);
  }

  if (!validationResult.valid) {
    console.error('❌ Package validation failed on AMO:');
    const messages = validationResult.validation?.messages || [];
    for (const msg of messages) {
      console.error(`  - [${msg.type || 'error'}] ${msg.message}`);
    }

    // Check if error is due to version already existing
    const isDuplicate = messages.some(m => /already exists|duplicate/i.test(m.message || ''));
    if (isDuplicate) {
      console.warn(`⚠️ Version ${validationResult.version} has already been uploaded to AMO. Skipping.`);
      process.exit(0);
    }

    process.exit(1);
  }

  console.log(`✓ Package validated successfully! Version parsed: ${validationResult.version}`);

  // Step 3: Create Version via Version Create API
  console.log(`\n[3/3] Submitting new version to AMO Version Create API...`);
  const versionPayload = {
    upload: uploadUuid
  };

  if (process.env.AMO_RELEASE_NOTES) {
    versionPayload.release_notes = {
      'en-US': process.env.AMO_RELEASE_NOTES
    };
  }

  if (process.env.AMO_APPROVAL_NOTES) {
    versionPayload.approval_notes = process.env.AMO_APPROVAL_NOTES;
  }

  const createResponse = await fetch(`${AMO_API_BASE}/addons/addon/${addonSlug}/versions/`, {
    method: 'POST',
    headers: {
      'Authorization': `JWT ${generateJwt(issuer, secret)}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    },
    body: JSON.stringify(versionPayload)
  });

  if (!createResponse.ok) {
    const errText = await createResponse.text();
    if (createResponse.status === 409 || /already exists/i.test(errText)) {
      console.warn(`⚠️ Version already exists on AMO: ${errText}`);
      process.exit(0);
    }
    console.error(`❌ Version Create API failed (HTTP ${createResponse.status}): ${errText}`);
    process.exit(1);
  }

  const versionResult = await createResponse.json();
  console.log(`\n🎉 Successfully published new version to AMO!`);
  console.log(`   - Add-on: https://addons.mozilla.org/en-US/firefox/addon/${addonSlug}/`);
  console.log(`   - Version: ${versionResult.version}`);
  console.log(`   - Version ID: ${versionResult.id}`);
  console.log(`   - Channel: ${versionResult.channel}`);
  console.log(`   - Status: ${versionResult.file?.status || 'submitted for review'}`);

  // Export step outputs if in GitHub Actions
  if (process.env.GITHUB_OUTPUT) {
    try {
      fs.appendFileSync(process.env.GITHUB_OUTPUT, `amo_version=${versionResult.version}\n`);
      fs.appendFileSync(process.env.GITHUB_OUTPUT, `amo_version_id=${versionResult.id}\n`);
    } catch {}
  }
}

publishToAmo().catch(err => {
  console.error('❌ Unexpected error in AMO Version Create publisher:', err);
  process.exit(1);
});

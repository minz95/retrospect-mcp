# API Keys Setup Guide

This guide explains how to obtain and configure API keys for all integrations in Retrospect MCP.

## Required API Keys

You need API keys for the following services:

1. **Claude API** (Anthropic) - Required for insight extraction
2. **Notion** - Optional, for cloud backup of daily logs
3. **Twitter/X (Thread)** - Optional, for posting to Twitter
4. **LinkedIn** - Optional, for posting to LinkedIn
5. **Medium** - Optional, for publishing articles

## Configuration File

All API keys are configured in `.env` file at the project root:

```bash
# Copy the example file
cp .env.example .env

# Edit with your API keys
nano .env
```

---

## 1. Claude API (Required)

### Obtaining the API Key

1. Go to [Anthropic Console](https://console.anthropic.com/)
2. Sign in or create an account
3. Navigate to **API Keys** section
4. Click **Create Key**
5. Copy the key (starts with `sk-ant-...`)

### Configuration

```bash
CLAUDE_API_KEY=sk-ant-api03-your-key-here
```

### Model Selection

Default model is `claude-sonnet-4-5-20250929`. You can change it in `config/default.json`:

```json
{
  "claude": {
    "apiKey": "${CLAUDE_API_KEY}",
    "model": "claude-sonnet-4-5-20250929"
  }
}
```

Available models:
- `claude-sonnet-4-5-20250929` (recommended, balanced)
- `claude-opus-4-5-20251101` (most capable, expensive)
- `claude-haiku-3-5-20241022` (fastest, cheapest)

---

## 2. Notion (Optional)

### Obtaining the API Token

1. Go to [Notion Integrations](https://www.notion.so/my-integrations)
2. Click **+ New integration**
3. Name: `Retrospect MCP`
4. Select workspace
5. Click **Submit**
6. Copy the **Internal Integration Token** (starts with `secret_...`)

### Getting Parent Page ID

1. Create a page in Notion where you want to store projects
2. Open the page in browser
3. Copy the page ID from URL:
   ```
   https://www.notion.so/Your-Page-Title-{PAGE_ID}?...
   ```
   The `PAGE_ID` is a 32-character string

4. **Important**: Share the page with your integration:
   - Click **...** menu on the page
   - Select **Add connections**
   - Choose your integration

### Configuration

```bash
NOTION_TOKEN=secret_your_token_here
NOTION_PARENT_PAGE_ID=a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6
```

---

## 3. Twitter/X (Thread) (Optional)

### Obtaining Bearer Token

**Method 1: Twitter Developer Portal (Recommended)**

1. Go to [Twitter Developer Portal](https://developer.twitter.com/en/portal/dashboard)
2. Create a new app or select existing app
3. Navigate to **Keys and tokens** tab
4. Generate **Bearer Token**
5. Copy the token

**Method 2: OAuth 2.0 User Context**

For posting tweets, you need **OAuth 2.0 User Access Token**:

1. In Developer Portal, enable **OAuth 2.0**
2. Set **Callback URL**: `http://localhost:3000/callback`
3. Request scopes: `tweet.read`, `tweet.write`, `users.read`
4. Use OAuth flow to get access token

**Note**: The current implementation uses bearer token. For production, you should implement OAuth 2.0 flow.

### Configuration

```bash
TWITTER_BEARER_TOKEN=your_bearer_token_here
```

### API Permissions Required

- Read and Write tweets
- Read user information

### Rate Limits

- Free tier: 50 tweets per 24 hours
- Basic tier: 100 tweets per 24 hours
- Pro tier: 10,000 tweets per 24 hours

---

## 4. LinkedIn (Optional)

### Obtaining Access Token

LinkedIn requires OAuth 2.0 flow:

1. Go to [LinkedIn Developers](https://www.linkedin.com/developers/apps)
2. Create a new app
3. Fill in app details
4. In **Auth** tab:
   - Add redirect URL: `http://localhost:3000/callback`
   - Request permissions: `w_member_social`, `r_basicprofile`
5. Copy **Client ID** and **Client Secret**

**OAuth Flow** (manual process):

1. Generate authorization URL:
   ```
   https://www.linkedin.com/oauth/v2/authorization?response_type=code&client_id={CLIENT_ID}&redirect_uri=http://localhost:3000/callback&scope=w_member_social%20r_basicprofile
   ```

2. Visit URL in browser, authorize app
3. Copy the `code` parameter from redirect URL
4. Exchange code for access token:
   ```bash
   curl -X POST https://www.linkedin.com/oauth/v2/accessToken \
     -H 'Content-Type: application/x-www-form-urlencoded' \
     -d 'grant_type=authorization_code' \
     -d 'code={CODE}' \
     -d 'redirect_uri=http://localhost:3000/callback' \
     -d 'client_id={CLIENT_ID}' \
     -d 'client_secret={CLIENT_SECRET}'
   ```

5. Copy the `access_token` from response

### Getting LinkedIn User ID

After obtaining access token:

```bash
curl https://api.linkedin.com/v2/me \
  -H 'Authorization: Bearer {ACCESS_TOKEN}'
```

Copy the `id` field from response (format: `urn:li:person:XXXXXXXXXX`)

### Configuration

```bash
LINKEDIN_ACCESS_TOKEN=your_access_token_here
LINKEDIN_USER_ID=urn:li:person:XXXXXXXXXX
```

### Token Expiration

- Access tokens expire in 60 days
- Implement refresh token flow for production use
- Current implementation requires manual token refresh

---

## 5. Medium (Optional)

### Obtaining Integration Token

1. Go to [Medium Settings](https://medium.com/me/settings)
2. Scroll to **Integration tokens**
3. Enter description: `Retrospect MCP`
4. Click **Get integration token**
5. Copy the token

### Configuration

```bash
MEDIUM_TOKEN=your_integration_token_here
```

### Default Publish Status

By default, Medium posts are created as **drafts** for safety. You can review and publish them manually in Medium.

To change default behavior, edit in code or use metadata.

---

## Configuration Summary

Your `.env` file should look like:

```bash
# Claude API (Required)
CLAUDE_API_KEY=sk-ant-api03-...

# Notion (Optional)
NOTION_TOKEN=secret_...
NOTION_PARENT_PAGE_ID=a1b2c3d4e5f6...

# Twitter/X (Optional)
TWITTER_BEARER_TOKEN=...

# LinkedIn (Optional)
LINKEDIN_ACCESS_TOKEN=...
LINKEDIN_USER_ID=urn:li:person:...

# Medium (Optional)
MEDIUM_TOKEN=...

# Obsidian (Required)
OBSIDIAN_VAULT_PATH=/Users/your-username/ObsidianVault

# Git (Optional, for commit analysis)
GIT_DEFAULT_REPO_PATH=/Users/your-username/projects/my-project

# Database (Optional, defaults to data/retrospect.db)
DATABASE_PATH=data/retrospect.db
```

---

## Testing API Keys

### Test Claude API

```bash
npm run test:claude
```

Or use the MCP tool to test:
```
extract_insights with a small date range
```

### Test Notion

```bash
npm run test:notion
```

Or create a test project:
```
create_project with projectName: "Test Project"
```

### Test SNS APIs

1. Create a test insight
2. Generate SNS post
3. Review in pending-posts
4. Approve with `approve_and_publish` (test mode)

---

## Security Best Practices

1. **Never commit `.env` file to git**
   - Already in `.gitignore`
   - Use `.env.example` as template

2. **Rotate tokens regularly**
   - LinkedIn tokens expire in 60 days
   - Refresh before expiration

3. **Use environment-specific configs**
   - Development: `.env.development`
   - Production: `.env.production`

4. **Restrict API permissions**
   - Only request necessary scopes
   - LinkedIn: Only `w_member_social` and `r_basicprofile`
   - Twitter: Only tweet read/write

5. **Monitor API usage**
   - Check rate limits
   - Set up billing alerts (Claude, Twitter)

---

## Troubleshooting

### Claude API Errors

- **401 Unauthorized**: Invalid API key
- **429 Too Many Requests**: Rate limit exceeded, wait and retry
- **500 Server Error**: Anthropic service issue, retry with backoff

### Notion Errors

- **401 Unauthorized**: Invalid token or integration not shared with page
- **404 Not Found**: Invalid parent page ID
- **Validation Error**: Check page permissions

### Twitter Errors

- **401 Unauthorized**: Invalid bearer token
- **403 Forbidden**: Insufficient permissions
- **429 Rate Limit**: Exceeded tweet limit, wait 24 hours

### LinkedIn Errors

- **401 Unauthorized**: Token expired, regenerate
- **403 Forbidden**: Missing permissions, check OAuth scopes
- **422 Validation Error**: Invalid user ID format

### Medium Errors

- **401 Unauthorized**: Invalid integration token
- **403 Forbidden**: Token revoked, regenerate

---

## Optional: Automated Token Refresh

For production use, implement OAuth refresh token flow:

1. Store refresh tokens securely
2. Check token expiration before API calls
3. Automatically refresh if expired
4. Update config with new tokens

This is not implemented in the current version but can be added in Phase 7 (Issue #28).

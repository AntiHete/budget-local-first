param(
  [string]$BaseUrl = "http://localhost:3000",
  [string]$PasswordA = "123456",
  [string]$PasswordB = "123456",
  [string]$NewPasswordA = "1234567"
)

$ErrorActionPreference = "Stop"

function Write-Step {
  param([string]$Text)
  Write-Host ""
  Write-Host "==> $Text" -ForegroundColor Cyan
}

function Invoke-ApiJson {
  param(
    [Parameter(Mandatory = $true)][string]$Method,
    [Parameter(Mandatory = $true)][string]$Url,
    $Body = $null,
    [string]$Token = $null
  )

  $headers = @{}
  if ($Token) {
    $headers["Authorization"] = "Bearer $Token"
  }

  $params = @{
    Method      = $Method
    Uri         = $Url
    Headers     = $headers
    ErrorAction = "Stop"
  }

  if ($null -ne $Body) {
    $params["ContentType"] = "application/json"
    $params["Body"] = ($Body | ConvertTo-Json -Depth 10 -Compress)
  }

  try {
    $response = Invoke-WebRequest @params
    $raw = $response.Content
    $json = $null

    if ($raw) {
      try { $json = $raw | ConvertFrom-Json } catch {}
    }

    return [pscustomobject]@{
      StatusCode = [int]$response.StatusCode
      Json       = $json
      Raw        = $raw
    }
  }
  catch {
    $webResponse = $_.Exception.Response
    if (-not $webResponse) {
      throw
    }

    $raw = ""
    $stream = $webResponse.GetResponseStream()
    if ($stream) {
      $reader = New-Object System.IO.StreamReader($stream)
      $raw = $reader.ReadToEnd()
      $reader.Dispose()
      $stream.Dispose()
    }

    $json = $null
    if ($raw) {
      try { $json = $raw | ConvertFrom-Json } catch {}
    }

    return [pscustomobject]@{
      StatusCode = [int]$webResponse.StatusCode
      Json       = $json
      Raw        = $raw
    }
  }
}

function Assert-Status {
  param(
    $Response,
    [int]$Expected,
    [string]$Message
  )

  if ($Response.StatusCode -ne $Expected) {
    throw "$Message. Expected status $Expected, got $($Response.StatusCode). Body: $($Response.Raw)"
  }

  Write-Host "✔ $Message" -ForegroundColor Green
}

function Assert-StatusIn {
  param(
    $Response,
    [int[]]$Expected,
    [string]$Message
  )

  if ($Expected -notcontains $Response.StatusCode) {
    throw "$Message. Expected one of [$($Expected -join ', ')], got $($Response.StatusCode). Body: $($Response.Raw)"
  }

  Write-Host "✔ $Message" -ForegroundColor Green
}

function Assert-True {
  param(
    [bool]$Condition,
    [string]$Message
  )

  if (-not $Condition) {
    throw $Message
  }

  Write-Host "✔ $Message" -ForegroundColor Green
}

$base = $BaseUrl.TrimEnd("/")
$seed = Get-Random -Minimum 100000 -Maximum 999999

$userA = [pscustomobject]@{
  email = "smoke-a-$seed@example.com"
  name  = "Smoke A $seed"
}

$userB = [pscustomobject]@{
  email = "smoke-b-$seed@example.com"
  name  = "Smoke B $seed"
}

Write-Host "Smoke target: $base" -ForegroundColor Yellow
Write-Host "User A: $($userA.email)" -ForegroundColor DarkGray
Write-Host "User B: $($userB.email)" -ForegroundColor DarkGray

# 1) HEALTH
Write-Step "Health check"
$health = Invoke-ApiJson -Method "GET" -Url "$base/api/health"
Assert-Status $health 200 "GET /api/health returns 200"
Assert-True ([bool]$health.Json.ok) "Health response contains ok=true"

# 2) REGISTER A
Write-Step "Register user A"
$registerA = Invoke-ApiJson -Method "POST" -Url "$base/api/auth/register" -Body @{
  email    = $userA.email
  password = $PasswordA
  name     = $userA.name
}
Assert-Status $registerA 200 "POST /api/auth/register for user A"
Assert-True ([bool]$registerA.Json.token) "User A register returns token"

# 3) LOGIN A
Write-Step "Login user A"
$loginA = Invoke-ApiJson -Method "POST" -Url "$base/api/auth/login" -Body @{
  email    = $userA.email
  password = $PasswordA
}
Assert-Status $loginA 200 "POST /api/auth/login for user A"
$tokenA = $loginA.Json.token
Assert-True ([bool]$tokenA) "User A login token exists"

# 4) ME
Write-Step "Get current user A"
$meA = Invoke-ApiJson -Method "GET" -Url "$base/api/me" -Token $tokenA
Assert-Status $meA 200 "GET /api/me for user A"
Assert-True ($meA.Json.user.email -eq $userA.email) "GET /api/me returns correct email for user A"

# 5) CREATE SHARED PROFILE
Write-Step "Create shared profile by user A"
$createProfile = Invoke-ApiJson -Method "POST" -Url "$base/api/profiles" -Token $tokenA -Body @{
  name = "Shared Smoke $seed"
}
Assert-Status $createProfile 200 "POST /api/profiles creates shared profile"
$sharedProfileId = $createProfile.Json.profile.id
Assert-True ([bool]$sharedProfileId) "Shared profile id was returned"

# 6) SELECT SHARED PROFILE AS A
Write-Step "Select shared profile as user A"
$selectA = Invoke-ApiJson -Method "POST" -Url "$base/api/profiles/select" -Token $tokenA -Body @{
  profileId = $sharedProfileId
}
Assert-Status $selectA 200 "POST /api/profiles/select for user A"
$tokenA = $selectA.Json.token
Assert-True ([bool]$tokenA) "User A received token for selected shared profile"

# 7) ACCOUNTS
Write-Step "Create account inside shared profile"
$accountsA = Invoke-ApiJson -Method "GET" -Url "$base/api/accounts" -Token $tokenA
Assert-Status $accountsA 200 "GET /api/accounts for user A"

$createAccount = Invoke-ApiJson -Method "POST" -Url "$base/api/accounts" -Token $tokenA -Body @{
  name                = "Smoke Card $seed"
  kind                = "card"
  currency            = "UAH"
  openingBalanceCents = 0
  isDefault           = $false
}
Assert-StatusIn $createAccount @(200, 201) "POST /api/accounts creates account"
$accountId = $createAccount.Json.account.id
Assert-True ([bool]$accountId) "Created account id was returned"

# 8) REGISTER B
Write-Step "Register user B"
$registerB = Invoke-ApiJson -Method "POST" -Url "$base/api/auth/register" -Body @{
  email    = $userB.email
  password = $PasswordB
  name     = $userB.name
}
Assert-Status $registerB 200 "POST /api/auth/register for user B"

# 9) ADD B AS VIEWER
Write-Step "Add user B to shared profile as viewer"
$addMember = Invoke-ApiJson -Method "POST" -Url "$base/api/profiles/members" -Token $tokenA -Body @{
  email = $userB.email
  role  = "viewer"
}
Assert-Status $addMember 200 "POST /api/profiles/members adds user B"
$memberId = $addMember.Json.member.id
Assert-True ([bool]$memberId) "Member id for user B was returned"

# 10) LOGIN B
Write-Step "Login user B"
$loginB = Invoke-ApiJson -Method "POST" -Url "$base/api/auth/login" -Body @{
  email    = $userB.email
  password = $PasswordB
}
Assert-Status $loginB 200 "POST /api/auth/login for user B"
$tokenB = $loginB.Json.token
Assert-True ([bool]$tokenB) "User B login token exists"

# 11) B MUST SEE SHARED PROFILE AND SELECT IT
Write-Step "List profiles for user B and select shared profile"
$listProfilesB = Invoke-ApiJson -Method "GET" -Url "$base/api/profiles" -Token $tokenB
Assert-Status $listProfilesB 200 "GET /api/profiles for user B"

$hasShared = @($listProfilesB.Json.profiles | Where-Object { $_.id -eq $sharedProfileId }).Count -gt 0
Assert-True $hasShared "User B sees shared profile in list"

$selectB = Invoke-ApiJson -Method "POST" -Url "$base/api/profiles/select" -Token $tokenB -Body @{
  profileId = $sharedProfileId
}
Assert-Status $selectB 200 "POST /api/profiles/select for user B"
$tokenB = $selectB.Json.token

# 12) OWNER CREATES TRANSACTION
Write-Step "Owner creates transaction"
$txCreateA = Invoke-ApiJson -Method "POST" -Url "$base/api/transactions" -Token $tokenA -Body @{
  accountId   = $accountId
  direction   = "expense"
  amountCents = 15000
  currency    = "UAH"
  category    = "Food"
  note        = "Smoke owner tx $seed"
  occurredAt  = (Get-Date).ToUniversalTime().ToString("o")
}
Assert-StatusIn $txCreateA @(200, 201) "POST /api/transactions by owner"
$txIdA = $txCreateA.Json.transaction.id
Assert-True ([bool]$txIdA) "Owner transaction id exists"

# 13) VIEWER CAN READ
Write-Step "Viewer reads transactions"
$listTxViewer = Invoke-ApiJson -Method "GET" -Url "$base/api/transactions" -Token $tokenB
Assert-Status $listTxViewer 200 "GET /api/transactions by viewer"

$viewerSeesOwnerTx = @($listTxViewer.Json.transactions | Where-Object { $_.id -eq $txIdA }).Count -gt 0
Assert-True $viewerSeesOwnerTx "Viewer sees owner transaction inside shared profile"

# 14) VIEWER CANNOT CREATE
Write-Step "Viewer must not create transaction"
$txCreateViewer = Invoke-ApiJson -Method "POST" -Url "$base/api/transactions" -Token $tokenB -Body @{
  accountId   = $accountId
  direction   = "expense"
  amountCents = 9900
  currency    = "UAH"
  category    = "Blocked"
  note        = "Viewer should be blocked"
  occurredAt  = (Get-Date).ToUniversalTime().ToString("o")
}
Assert-Status $txCreateViewer 403 "Viewer is blocked from POST /api/transactions"

# 15) PROMOTE B TO EDITOR
Write-Step "Promote user B to editor"
$promoteB = Invoke-ApiJson -Method "PATCH" -Url "$base/api/profiles/members" -Token $tokenA -Body @{
  memberId = $memberId
  role     = "editor"
}
Assert-Status $promoteB 200 "PATCH /api/profiles/members promotes user B to editor"

# 16) EDITOR CAN CREATE
Write-Step "Editor creates transaction"
$txCreateB = Invoke-ApiJson -Method "POST" -Url "$base/api/transactions" -Token $tokenB -Body @{
  accountId   = $accountId
  direction   = "income"
  amountCents = 22000
  currency    = "UAH"
  category    = "Salary"
  note        = "Smoke editor tx $seed"
  occurredAt  = (Get-Date).ToUniversalTime().ToString("o")
}
Assert-StatusIn $txCreateB @(200, 201) "Editor can POST /api/transactions"
$txIdB = $txCreateB.Json.transaction.id
Assert-True ([bool]$txIdB) "Editor transaction id exists"

# 17) PATCH + DELETE TRANSACTION AS OWNER
Write-Step "Owner patches and deletes own transaction"
$patchTx = Invoke-ApiJson -Method "PATCH" -Url "$base/api/transactions/$txIdA" -Token $tokenA -Body @{
  note = "Smoke owner tx updated $seed"
}
Assert-Status $patchTx 200 "PATCH /api/transactions/:id by owner"

$deleteTx = Invoke-ApiJson -Method "DELETE" -Url "$base/api/transactions/$txIdA" -Token $tokenA
Assert-Status $deleteTx 200 "DELETE /api/transactions/:id by owner"

# 18) CHANGE PASSWORD FOR A
Write-Step "Change password for user A"
$changePassword = Invoke-ApiJson -Method "POST" -Url "$base/api/auth/change-password" -Token $tokenA -Body @{
  currentPassword = $PasswordA
  newPassword     = $NewPasswordA
  confirmPassword = $NewPasswordA
}
Assert-Status $changePassword 200 "POST /api/auth/change-password for user A"

# 19) OLD PASSWORD MUST FAIL
Write-Step "Old password must stop working"
$oldLoginA = Invoke-ApiJson -Method "POST" -Url "$base/api/auth/login" -Body @{
  email    = $userA.email
  password = $PasswordA
}
Assert-Status $oldLoginA 401 "Old password no longer works for user A"

# 20) NEW PASSWORD MUST WORK
Write-Step "New password must work"
$newLoginA = Invoke-ApiJson -Method "POST" -Url "$base/api/auth/login" -Body @{
  email    = $userA.email
  password = $NewPasswordA
}
Assert-Status $newLoginA 200 "New password works for user A"

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "SMOKE TEST PASSED" -ForegroundColor Green
Write-Host "BaseUrl: $base" -ForegroundColor DarkGray
Write-Host "User A:  $($userA.email)" -ForegroundColor DarkGray
Write-Host "User B:  $($userB.email)" -ForegroundColor DarkGray
Write-Host "Profile: $sharedProfileId" -ForegroundColor DarkGray
Write-Host "Account: $accountId" -ForegroundColor DarkGray
Write-Host "========================================" -ForegroundColor Green
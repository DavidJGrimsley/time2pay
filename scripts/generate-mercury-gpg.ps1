param(
  [Parameter(Mandatory = $true)]
  [string]$Name,

  [Parameter(Mandatory = $true)]
  [string]$Email,

  [string]$OutputPrefix = "mercury-time2pay-public",

  [string]$Passphrase,

  [string]$SecureOutputDir = ""
)

$ErrorActionPreference = "Stop"

if (-not $SecureOutputDir) {
  $SecureOutputDir = Join-Path $env:LOCALAPPDATA "Time2Pay\mercury-gpg"
}

$gpgCommand = Get-Command gpg -ErrorAction SilentlyContinue
if (-not $gpgCommand) {
  $candidatePaths = @(
    "C:\Program Files\GnuPG\bin\gpg.exe",
    "C:\Program Files (x86)\GnuPG\bin\gpg.exe"
  )

  $resolvedPath = $candidatePaths | Where-Object { Test-Path $_ } | Select-Object -First 1
  if (-not $resolvedPath) {
    throw "gpg is not installed or not available in PATH. Install GnuPG first."
  }

  $gpgExe = $resolvedPath
} else {
  $gpgExe = $gpgCommand.Source
}

if (-not $Passphrase) {
  $randomBytes = New-Object byte[] 24
  $rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
  $rng.GetBytes($randomBytes)
  $rng.Dispose()
  $Passphrase = [Convert]::ToBase64String($randomBytes)
}

$repoRoot = Split-Path -Parent $PSScriptRoot
$keyDir = Join-Path $repoRoot "project/keys"
if (-not (Test-Path $keyDir)) {
  New-Item -ItemType Directory -Path $keyDir | Out-Null
}

if (-not (Test-Path $SecureOutputDir)) {
  New-Item -ItemType Directory -Path $SecureOutputDir -Force | Out-Null

  # Lock down the directory to the current user only
  $directorySecurity = New-Object System.Security.AccessControl.DirectorySecurity

  $currentUser = New-Object System.Security.Principal.NTAccount([System.Security.Principal.WindowsIdentity]::GetCurrent().Name)
  $fileSystemRights = [System.Security.AccessControl.FileSystemRights]::FullControl
  $inheritanceFlags = [System.Security.AccessControl.InheritanceFlags]'ContainerInherit, ObjectInherit'
  $propagationFlags = [System.Security.AccessControl.PropagationFlags]::None
  $accessControlType = [System.Security.AccessControl.AccessControlType]::Allow

  $accessRule = New-Object System.Security.AccessControl.FileSystemAccessRule(
    $currentUser,
    $fileSystemRights,
    $inheritanceFlags,
    $propagationFlags,
    $accessControlType
  )

  # Remove inherited permissions and apply only this rule
  $directorySecurity.SetAccessRuleProtection($true, $false)
  $directorySecurity.SetAccessRule($accessRule)

  Set-Acl -Path $SecureOutputDir -AclObject $directorySecurity
}

function Get-LatestPrimaryFingerprint {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Identifier
  )

  $lines = & $gpgExe --list-secret-keys --with-colons -- $Identifier
  $records = @()
  $capturePrimaryFpr = $false
  $createdAt = 0

  foreach ($line in $lines) {
    if (-not $line) {
      continue
    }

    $parts = $line -split ":"
    $recordType = $parts[0]

    if ($recordType -eq "sec") {
      $capturePrimaryFpr = $true
      $createdAt = [int64]$parts[5]
      continue
    }

    if ($recordType -eq "fpr" -and $capturePrimaryFpr) {
      $records += [PSCustomObject]@{
        CreatedAt = $createdAt
        Fingerprint = $parts[9]
      }
      $capturePrimaryFpr = $false
    }
  }

  if (-not $records -or $records.Count -eq 0) {
    return $null
  }

  return ($records | Sort-Object CreatedAt -Descending | Select-Object -First 1).Fingerprint
}

$batchFile = [System.IO.Path]::GetTempFileName()
@"
Key-Type: eddsa
Key-Curve: ed25519
Subkey-Type: ecdh
Subkey-Curve: cv25519
Name-Real: $Name
Name-Email: $Email
Expire-Date: 1y
Passphrase: $Passphrase
%commit
"@ | Set-Content -Path $batchFile -Encoding ascii

try {
  & $gpgExe --batch --pinentry-mode loopback --generate-key $batchFile

  $fingerprint = Get-LatestPrimaryFingerprint -Identifier $Email

  if (-not $fingerprint) {
    throw "Unable to resolve generated key fingerprint for $Email."
  }

  $publicKeyPath = Join-Path $keyDir "$OutputPrefix.asc"
  $fingerprintPath = Join-Path $keyDir "$OutputPrefix-fingerprint.txt"
  $privateKeyPath = Join-Path $SecureOutputDir "$OutputPrefix-private.asc"
  $privateFingerprintPath = Join-Path $SecureOutputDir "$OutputPrefix-fingerprint.txt"
  $passphrasePath = Join-Path $SecureOutputDir "$OutputPrefix-passphrase.txt"
  $revocationPath = Join-Path $SecureOutputDir "$OutputPrefix-revocation.rev"
  $defaultRevocationPath = Join-Path (Join-Path $env:APPDATA "gnupg\openpgp-revocs.d") "$fingerprint.rev"

  & $gpgExe --armor --export $fingerprint | Set-Content -Path $publicKeyPath -Encoding ascii
  Set-Content -Path $fingerprintPath -Value $fingerprint -Encoding ascii
  Set-Content -Path $privateFingerprintPath -Value $fingerprint -Encoding ascii

  $Passphrase | & $gpgExe --batch --yes --pinentry-mode loopback --passphrase-fd 0 --armor --export-secret-keys $fingerprint |
    Set-Content -Path $privateKeyPath -Encoding ascii

  if (Test-Path $defaultRevocationPath) {
    Copy-Item -Path $defaultRevocationPath -Destination $revocationPath -Force
  } else {
    throw "Could not find generated revocation certificate at $defaultRevocationPath"
  }

  Set-Content -Path $passphrasePath -Value $Passphrase -Encoding ascii

  Write-Host "Generated Mercury public key artifacts:"
  Write-Host "- $publicKeyPath"
  Write-Host "- $fingerprintPath"
  Write-Host "Generated private backup artifacts (keep offline):"
  Write-Host "- $privateKeyPath"
  Write-Host "- $revocationPath"
  Write-Host "- $passphrasePath"
  Write-Host "Fingerprint: $fingerprint"
}
finally {
  Remove-Item -Path $batchFile -ErrorAction SilentlyContinue
}

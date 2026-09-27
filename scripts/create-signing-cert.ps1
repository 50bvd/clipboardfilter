# Creates a self-signed code signing certificate in the maintainer's name, to be
# stored in the repository secrets so that every release is signed with the same
# certificate (Settings > Secrets and variables > Actions):
#   WINDOWS_SELF_SIGNED_PFX           = content of codesign.pfx.base64.txt
#   WINDOWS_SELF_SIGNED_PFX_PASSWORD  = the password you typed
# Delete the generated files afterwards: the .pfx contains the private key.
param(
    [string]$Name = 'Loup LIGNON KRASNIQI',
    [int]$Years = 5
)

$password = Read-Host -AsSecureString 'Password for the certificate'
$cert = New-SelfSignedCertificate -Type CodeSigningCert `
    -Subject "CN=$Name, O=ClipboardFilter, C=FR" `
    -KeyAlgorithm RSA -KeyLength 3072 -HashAlgorithm SHA256 `
    -NotAfter (Get-Date).AddYears($Years) -CertStoreLocation Cert:\CurrentUser\My

Export-PfxCertificate -Cert $cert -FilePath codesign.pfx -Password $password | Out-Null
[Convert]::ToBase64String([IO.File]::ReadAllBytes((Resolve-Path codesign.pfx))) |
    Set-Content -NoNewline -Encoding ascii codesign.pfx.base64.txt
Remove-Item "Cert:\CurrentUser\My\$($cert.Thumbprint)"

Write-Host ''
Write-Host "Certificate created: $($cert.Subject) (thumbprint $($cert.Thumbprint))" -ForegroundColor Green
Write-Host '1. Copy the content of codesign.pfx.base64.txt into the secret WINDOWS_SELF_SIGNED_PFX'
Write-Host '2. Put the password in the secret WINDOWS_SELF_SIGNED_PFX_PASSWORD'
Write-Host '3. Delete codesign.pfx and codesign.pfx.base64.txt (keep a backup somewhere safe if you want)'

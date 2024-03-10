#Requires -RunAsAdministrator

Param(
  [Parameter(Mandatory=$false)]
  [string] $GeneratedPath = "$PSScriptRoot\generated",

  [Parameter(Mandatory=$false, ParameterSetName="Import")]
  [string] $CertificateAuthorityFile = "$PSScriptRoot\CA.pem",

  [Parameter(Mandatory=$false, ParameterSetName="Import")]
  [string] $TargetCertStoreLocation = "Cert:\LocalMachine\Root",

  [Parameter(Mandatory=$true, ParameterSetName="Generate")]
  [switch] $GenerateCA,

  [Parameter(Mandatory=$false, ParameterSetName="Generate")]
  [string] $CAName = "Mike Boharsik",

  [Parameter(Mandatory=$false, ParameterSetName="Generate")]
  [string] $CAOutPath = "$GeneratedPath\CA.pfx",

  [Parameter(Mandatory=$false, ParameterSetName="Generate")]
  [string] $ServerOutPath = "$GeneratedPath\server.pfx",

  [Parameter(Mandatory=$false, ParameterSetName="Generate")]
  [string] $GeneratedFilesOutputPath = $PSScriptRoot,

	[string] $Hostname = "mike-desktop"
)

try {
  if ($GenerateCA) {
    # https://systemcenterdudes.com/powershell-generate-certificates-lab/

    $now = Get-Date
    $expires = $now.AddYears(100)

    $CA = New-SelfSignedCertificate `
      -DnsName $CAName `
      -KeyUsage CertSign `
      -NotAfter $expires `
      -KeyAlgorithm RSA `
      -KeyLength 2048 `
      -TextExtension @("2.5.29.30={text}Email=mboharsik@gmail.com")

    Write-host "Certificate Thumbprint: $($CA.Thumbprint)"

    if (Test-Path $GeneratedPath) {
      Remove-Item "$GeneratedPath\*"
    } else {
      mkdir $GeneratedPath | Out-Null
    }

    $pass = ConvertTo-SecureString -String "2024022720300020240227203000" -AsPlainText
    Export-PfxCertificate -Cert $CA -FilePath $CAOutPath -Password $pass  | Out-Null

    & 'C:\Program Files\Git\usr\bin\openssl.exe' pkcs12 -in $CAOutPath -nokeys -out "$GeneratedPath\CA.pem" -nodes

    $ServerCert = New-SelfSignedCertificate `
      -DnsName $Hostname `
      -Signer $CA `
      -NotAfter $expires `
      -TextExtension @("2.5.29.30={text}Email=mboharsik@gmail.com")

    Export-PfxCertificate -Cert $ServerCert -FilePath $ServerOutPath -Password $pass | Out-Null

    & 'C:\Program Files\Git\usr\bin\openssl.exe' pkcs12 -in $ServerOutPath -nocerts -out "$GeneratedPath\generated.key" -nodes
    & 'C:\Program Files\Git\usr\bin\openssl.exe' pkcs12 -in $ServerOutPath -nokeys -out "$GeneratedPath\generated.pem" -nodes
    & 'C:\Program Files\Git\usr\bin\openssl.exe' rsa -in "$GeneratedPath\generated.key" -out "$GeneratedPath\generated.key"

    Remove-Item "$GeneratedPath\*.pfx"

    Move-Item "$GeneratedPath\CA.pem" "$GeneratedFilesOutputPath\CA.pem" -Force
    Move-Item "$GeneratedPath\localhost.key" "$GeneratedFilesOutputPath\localhost.key" -Force
    Move-Item "$GeneratedPath\localhost.pem" "$GeneratedFilesOutputPath\localhost.crt" -Force

    exit 0
  }

  Import-Certificate `
		-FilePath $CertificateAuthorityFile `
		-CertStoreLocation $TargetCertStoreLocation `
		| Out-Null

  Write-Host "Imported cert '$CertificateAuthorityFile' into the local cert store at '$TargetCertStoreLocation'"
} catch {
  throw $_
}
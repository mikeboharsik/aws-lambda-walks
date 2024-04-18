

Describe 'Invoke-ConvertRawWalkTimestamps' {
	Describe 'with mock data' {
		BeforeAll {
			$testJson = @{
				name = "test"
				start = "00:01:00.000"
				end = "00:15:00.000"
				exif = @(
					@{ CreateDate = "2024:01:01 00:00:00"; Duration = "00:05:00" }
					@{ CreateDate = "2024:01:01 00:00:00"; Duration = "00:05:00" }

					# -1min for start

					@{ CreateDate = "2024:01:01 00:11:00"; Duration = "00:05:00" }
					@{ CreateDate = "2024:01:01 00:11:00"; Duration = "00:05:00" }

					# -1min for start, -1min for gap

					@{ CreateDate = "2024:01:01 00:22:00"; Duration = "00:05:00" }
					@{ CreateDate = "2024:01:01 00:22:00"; Duration = "00:05:00" }
				)
				events = @(
					@{ mark = "00:00:30.000"; name = "First" }
					@{ mark = "00:04:00.000"; name = "Second" }
					@{ mark = "00:07:00.000"; name = "Third" }
					@{ mark = "00:14:00.000"; name = "Fourth" }
					@{ mark = "00:23:00.000"; name = "Fifth" }
				)
			}
		}

		It 'properly calculates every event trimmedStart value' {
			$result = & "$PSScriptRoot\Invoke-ConvertRawWalkTimestamps.ps1" -Date 2024-03-24 -SourceJson $testJson -ReturnData
			$firstEvent, $secondEvent, $thirdEvent, $fourthEvent, $fifthEvent = $result.events

			$firstEvent.trimmedStart | Should -Be "-00:00:30"
			$secondEvent.trimmedStart | Should -Be "00:03:00"
			$thirdEvent.trimmedStart | Should -Be "00:06:00"
			$fourthEvent.trimmedStart | Should -Be "00:12:00"
			$fifthEvent.trimmedStart | Should -Be "00:20:00"
		}
	}

	Describe 'with real data' {
		BeforeAll {
			$testJson = @{
				date = "2024-03-24"
				start = "00:04:09.488"
				end = "01:13:31.791"
				route = "FE669860-69F3-419B-B025-E7B23C65ADC9"
				events = @(
					@{
						mark = "00:04:50.272"
						name = "2tcd 97 ma space"
						trimmedStart = "00:00:40"
						trimmedEnd = "00:00:40"
					},
					@{
						mark = "00:05:25.597"
						name = "Driver changes lane without signal"
						trimmedStart = "00:01:16"
						trimmedEnd = "00:01:16"
					},
					@{
						mark = "00:11:52.543"
						plate = "MA 1RAY 21"
						trimmedStart = "00:07:43"
					},
					@{
						mark = "00:12:09.635"
						plate = "MA 4WXP 10"
						trimmedStart = "00:08:00"
					},
					@{
						mark = "00:13:20.249"
						plate = "MA ILVKAZ"
						trimmedStart = "00:09:10"
					},
					@{
						mark = "00:13:36.761"
						plate = "MA 3DTN 34"
						trimmedStart = "00:09:27"
					},
					@{
						mark = "00:14:52.439"
						name = "Driver turns without signal ma s 100"
						trimmedStart = "00:10:42"
						trimmedEnd = "00:10:42"
					},
					@{
						mark = "00:15:44.062"
						name = "Driver turns without signal?"
						trimmedStart = "00:11:34"
						trimmedEnd = "00:11:34"
					},
					@{
						mark = "00:16:55.165"
						plate = "MA 5ARG?"
						trimmedStart = "00:12:45"
					},
					@{
						mark = "00:18:50.983"
						name = "Cops pulling up on CVS"
						trimmedStart = "00:14:41"
						trimmedEnd = "00:14:41"
					},
					@{
						mark = "00:20:19.330"
						plate = "MA 2KCL 38"
						trimmedStart = "00:16:09"
					},
					@{
						mark = "00:21:52.951"
						plate = "MA "
						trimmedStart = "00:17:43"
					},
					@{
						mark = "00:21:54.851"
						plate = "MA "
						trimmedStart = "00:17:45"
					},
					@{
						mark = "00:23:32.486"
						name = "Sidewalk MAX"
						trimmedStart = "00:19:22"
						trimmedEnd = "00:19:22"
					},
					@{
						mark = "00:24:15.542"
						plate = "MA 928 YTM"
						trimmedStart = "00:20:06"
					},
					@{
						mark = "00:25:27.573"
						name = "Driver turns without signal"
						trimmedStart = "00:21:18"
						trimmedEnd = "00:21:18"
					},
					@{
						mark = "00:26:13.463"
						plate = "MA "
						trimmedStart = "00:22:03"
					},
					@{
						mark = "00:26:14.979"
						plate = "MA "
						trimmedStart = "00:22:05"
					},
					@{
						mark = "00:26:16.578"
						plate = "MA "
						trimmedStart = "00:22:07"
					},
					@{
						mark = "00:26:18.112"
						plate = "MA "
						trimmedStart = "00:22:08"
					},
					@{
						mark = "00:27:32.008"
						tag = "Kore?"
						trimmedStart = "00:23:22"
					},
					@{
						mark = "00:27:47.805"
						name = "Driver turns without signal"
						trimmedStart = "00:23:38"
						trimmedEnd = "00:23:38"
					},
					@{
						mark = "00:30:45.974"
						plate = "MA "
						trimmedStart = "00:26:36"
					},
					@{
						mark = "00:30:47.657"
						plate = "MA "
						trimmedStart = "00:26:38"
					},
					@{
						mark = "00:30:53.006"
						plate = "MA "
						trimmedStart = "00:26:43"
					},
					@{
						mark = "00:31:59.370"
						plate = "MA 1DGT 53"
						trimmedStart = "00:27:49"
					},
					@{
						mark = "00:32:39.560"
						plate = "MA 281 WTN"
						trimmedStart = "00:28:30"
					},
					@{
						mark = "00:33:08.441"
						name = "Driver turns without signal"
						trimmedStart = "00:28:58"
						trimmedEnd = "00:28:58"
					},
					@{
						mark = "00:33:22.406"
						name = "Driver turns without signal"
						trimmedStart = "00:29:12"
						trimmedEnd = "00:29:12"
					},
					@{
						mark = "00:34:07.541"
						plate = "MA 1LPL 97"
						trimmedStart = "00:29:58"
					},
					@{
						mark = "00:35:14.975"
						plate = "MA 3KPW 28"
						trimmedStart = "00:31:05"
					},
					@{
						mark = "00:35:59.711"
						name = "West Park road House construction"
						trimmedStart = "00:31:50"
						trimmedEnd = "00:31:50"
					},
					@{
						mark = "00:37:41.531"
						name = "Jordan avenue New House construction"
						trimmedStart = "00:33:32"
						trimmedEnd = "00:33:32"
					},
					@{
						mark = "00:38:15.344"
						plate = "MA 1GAD 44"
						trimmedStart = "00:34:05"
					},
					@{
						mark = "00:39:25.907"
						plate = "MA 3FW 617"
						trimmedStart = "00:35:16"
					},
					@{
						mark = "00:40:00.748"
						plate = "MA 6S1"
						trimmedStart = "00:35:51"
					},
					@{
						mark = "00:40:23.842"
						plate = "MA 2CKK 35"
						trimmedStart = "00:36:14"
					},
					@{
						mark = "00:40:51.571"
						plate = "MA "
						trimmedStart = "00:36:42"
					},
					@{
						mark = "00:40:53.285"
						plate = "MA "
						trimmedStart = "00:36:43"
					},
					@{
						mark = "00:41:16.860"
						plate = "MA 2MAY 76"
						trimmedStart = "00:37:07"
					},
					@{
						mark = "00:42:44.375"
						plate = "MA 3AVG 39"
						trimmedStart = "00:38:34"
					},
					@{
						mark = "00:43:08.392"
						plate = "MA "
						trimmedStart = "00:38:58"
					},
					@{
						mark = "00:43:11.404"
						plate = "MA "
						trimmedStart = "00:39:01"
					},
					@{
						mark = "00:43:26.465"
						plate = "MA "
						trimmedStart = "00:39:16"
					},
					@{
						mark = "00:43:31.807"
						plate = "MA "
						trimmedStart = "00:39:22"
					},
					@{
						mark = "00:43:33.655"
						plate = "MA A"
						trimmedStart = "00:39:24"
					},
					@{
						mark = "00:44:52.645"
						plate = "MA "
						trimmedStart = "00:40:43"
					},
					@{
						mark = "00:44:54.392"
						plate = "MA "
						trimmedStart = "00:40:44"
					},
					@{
						mark = "00:45:29.856"
						plate = "MA 1CRM 33"
						trimmedStart = "00:41:20"
					},
					@{
						mark = "00:46:51.184"
						name = "Driver turns without signal 2tgr 42?"
						trimmedStart = "00:42:41"
						trimmedEnd = "00:42:41"
					},
					@{
						mark = "00:47:11.388"
						plate = "MA RUDDY"
						trimmedStart = "00:43:01"
					},
					@{
						mark = "00:47:44.099"
						plate = "MA 2WDA 59"
						trimmedStart = "00:43:34"
					},
					@{
						mark = "00:48:26.403"
						plate = "MA 433 S"
						trimmedStart = "00:44:16"
					},
					@{
						mark = "00:49:53.470"
						plate = "MA 18PA 19"
						trimmedStart = "00:45:43"
					},
					@{
						mark = "00:50:22.789"
						plate = "MA 2DDE 13"
						trimmedStart = "00:46:13"
					},
					@{
						mark = "00:52:16.315"
						name = "Driver runs stop sign"
						trimmedStart = "00:48:06"
						trimmedEnd = "00:48:06"
					},
					@{
						mark = "00:53:34.602"
						plate = "MA THTZAL?"
						trimmedStart = "00:49:25"
					},
					@{
						mark = "00:55:01.144"
						plate = "MA 2GWP 83"
						trimmedStart = "00:50:51"
					},
					@{
						mark = "00:57:21.883"
						plate = "MA 437 XM5"
						trimmedStart = "00:53:12"
					},
					@{
						mark = "00:58:17.083"
						name = "Driver turns without signal"
						trimmedStart = "00:54:07"
						trimmedEnd = "00:54:07"
					},
					@{
						mark = "00:59:26.306"
						plate = "MA 2TPA 41"
						trimmedStart = "00:55:16"
					},
					@{
						mark = "00:59:50.382"
						plate = "MA 6625 KL "
						trimmedStart = "00:55:40"
					},
					@{
						mark = "01:00:21.687"
						plate = "MA 78H K99"
						trimmedStart = "00:56:12"
					},
					@{
						mark = "01:03:27.966"
						name = "Roadside mulch"
						trimmedStart = "00:59:18"
						trimmedEnd = "00:59:18"
					},
					@{
						mark = "01:04:04.316"
						plate = "MA 3975 YZ"
						trimmedStart = "00:59:54"
					},
					@{
						mark = "01:05:54.892"
						plate = "MA 3KR 141"
						trimmedStart = "01:01:45"
					},
					@{
						mark = "01:06:08.898"
						plate = "MA 4KXY 95?"
						trimmedStart = "01:01:59"
					},
					@{
						mark = "01:06:38.460"
						plate = "MA "
						trimmedStart = "01:02:28"
					},
					@{
						mark = "01:06:39.559"
						plate = "MA 474 U"
						trimmedStart = "01:02:30"
					},
					@{
						mark = "01:06:50.556"
						plate = "MA 1KDP 58"
						trimmedStart = "01:02:41"
					},
					@{
						mark = "01:09:02.535"
						name = "Driver turns without signal"
						trimmedStart = "01:04:53"
						trimmedEnd = "01:04:53"
					},
					@{
						mark = "01:10:57.298"
						plate = "MA 4040 XC "
						trimmedStart = "01:06:47"
					},
					@{
						mark = "01:11:40.749"
						plate = "MA 5678 TX?"
						trimmedStart = "01:07:31"
					},
					@{
						mark = "01:12:06.922"
						plate = "MA 4BGZ 21?"
						trimmedStart = "01:07:57"
					},
					@{
						mark = "01:12:53.822"
						plate = "MA "
						trimmedStart = "01:08:44"
					},
					@{
						mark = "01:12:55.054"
						plate = "MA "
						trimmedStart = "01:08:45"
					},
					@{
						mark = "01:13:24.449"
						plate = "MA 2GSA?"
						trimmedStart = "01:09:14"
					},
					@{
						mark = "01:15:47.048"
						plate = "MA 5DBF 18 TINT"
						trimmedStart = "01:11:37"
					},
					@{
						mark = "01:17:22.408"
						plate = "MA CL 4436?"
						trimmedStart = "01:13:12"
					}
				)
				videos = @{
					"fSOwZGQ-VBI" = @(
						"00:00:05",
						"00:00:22"
					)
				}
				towns = @{
					MA = @(
						"Stoneham",
						"Wakefield"
					)
				}
				exif = @(
					@{
						SourceFile = "D:/wip/walks/2024-03-24/GX_0004_01.MP4"
						ExifToolVersion = 12.29
						FileName = "GX_0004_01.MP4"
						Directory = "D:/wip/walks/2024-03-24"
						FileSize = "11 GiB"
						FileModifyDate = "2024:03:24 16:56:31-04:00"
						FileAccessDate = "2024:03:24 18:36:38-04:00"
						FileCreateDate = "2024:03:24 18:34:36-04:00"
						FilePermissions = "-rw-rw-rw-"
						FileType = "MP4"
						FileTypeExtension = "mp4"
						MIMEType = "video/mp4"
						MajorBrand = "MP4 v1 [ISO 14496-1:ch13]"
						MinorVersion = "2013.10.18"
						CompatibleBrands = @(
							"mp41"
						)
						MediaDataSize = 11523095078
						MediaDataOffset = 36
						MovieHeaderVersion = 0
						CreateDate = "2024:03:24 21:30:52"
						ModifyDate = "2024:03:24 21:30:52"
						TimeScale = 60000
						Duration = "0:25:38"
						PreferredRate = 1
						PreferredVolume = "100.00%"
						PreviewTime = "0 s"
						PreviewDuration = "0 s"
						PosterTime = "0 s"
						SelectionTime = "0 s"
						SelectionDuration = "0 s"
						CurrentTime = "0 s"
						NextTrackID = 5
						LensSerialNumber = "LSU2061501400799"
						SerialNumberHash = "f2a4977be60c509ddbdfe8b18fd8cb15"
						MetadataVersion = "8.2.0"
						FirmwareVersion = "H22.01.02.20.00"
						CameraSerialNumber = "C3471325335652"
						Model = "HERO11 Black"
						AutoRotation = "Up"
						DigitalZoom = "Yes"
						ProTune = "On"
						WhiteBalance = "AUTO"
						Sharpness = "MED"
						ColorMode = "NATURAL"
						AutoISOMax = 3200
						AutoISOMin = 100
						ExposureCompensation = 0.0
						Rate = ""
						ElectronicImageStabilization = "HS EIS"
						AudioSetting = "AUTO"
						FieldOfView = "Linear"
						DeviceName = "Highlights"
						TrackHeaderVersion = 0
						TrackCreateDate = "2024:03:24 21:30:52"
						TrackModifyDate = "2024:03:24 21:30:52"
						TrackID = 1
						TrackDuration = "0:25:38"
						TrackLayer = 0
						TrackVolume = "0.00%"
						ImageWidth = 5312
						ImageHeight = 2988
						GraphicsMode = "srcCopy"
						OpColor = "0 0 0"
						CompressorID = "hvc1"
						SourceImageWidth = 5312
						SourceImageHeight = 2988
						XResolution = 72
						YResolution = 72
						CompressorName = "GoPro H.265 encoder"
						BitDepth = 24
						VideoFrameRate = 59.94
						TimeCode = 3
						Balance = 0
						AudioFormat = "mp4a"
						AudioChannels = 2
						AudioBitsPerSample = 24
						AudioSampleRate = 48000
						TextFont = "Unknown (21)"
						TextFace = "Plain"
						TextSize = 10
						TextColor = "0 0 0"
						BackgroundColor = "65535 65535 65535"
						FontName = "Helvetica"
						OtherFormat = "tmcd"
						MatrixStructure = "1 0 0 0 1 0 0 0 1"
						MediaHeaderVersion = 0
						MediaCreateDate = "2024:03:24 21:30:52"
						MediaModifyDate = "2024:03:24 21:30:52"
						MediaTimeScale = 1000
						MediaDuration = "0:25:38"
						HandlerClass = "Media Handler"
						HandlerType = "NRT Metadata"
						HandlerDescription = "GoPro MET  "
						GenMediaVersion = 0
						GenFlags = "0 0 0"
						GenGraphicsMode = "srcCopy"
						GenOpColor = "0 0 0"
						GenBalance = 0
						MetaFormat = "gpmd"
						Warning = "[minor] The ExtractEmbedded option may find more tags in the media data"
						ImageSize = "5312x2988"
						Megapixels = 15.9
						AvgBitrate = "60 Mbps"
						Rotation = 0
					}
					@{
						SourceFile = "D:/wip/walks/2024-03-24/GX_0004_02.MP4"
						ExifToolVersion = 12.29
						FileName = "GX_0004_02.MP4"
						Directory = "D:/wip/walks/2024-03-24"
						FileSize = "10.0 GiB"
						FileModifyDate = "2024:03:24 17:20:23-04:00"
						FileAccessDate = "2024:03:24 18:40:32-04:00"
						FileCreateDate = "2024:03:24 18:38:39-04:00"
						FilePermissions = "-rw-rw-rw-"
						FileType = "MP4"
						FileTypeExtension = "mp4"
						MIMEType = "video/mp4"
						MajorBrand = "MP4 v1 [ISO 14496-1:ch13]"
						MinorVersion = "2013.10.18"
						CompatibleBrands = @(
							"mp41"
						)
						MediaDataSize = 10733497930
						MediaDataOffset = 36
						MovieHeaderVersion = 0
						CreateDate = "2024:03:24 21:30:52"
						ModifyDate = "2024:03:24 21:30:52"
						TimeScale = 60000
						Duration = "0:23:52"
						PreferredRate = 1
						PreferredVolume = "100.00%"
						PreviewTime = "0 s"
						PreviewDuration = "0 s"
						PosterTime = "0 s"
						SelectionTime = "0 s"
						SelectionDuration = "0 s"
						CurrentTime = "0 s"
						NextTrackID = 5
						LensSerialNumber = "LSU2061501400799"
						SerialNumberHash = "f2a4977be60c509ddbdfe8b18fd8cb15"
						MetadataVersion = "8.2.0"
						FirmwareVersion = "H22.01.02.20.00"
						CameraSerialNumber = "C3471325335652"
						Model = "HERO11 Black"
						AutoRotation = "Up"
						DigitalZoom = "Yes"
						ProTune = "On"
						WhiteBalance = "AUTO"
						Sharpness = "MED"
						ColorMode = "NATURAL"
						AutoISOMax = 3200
						AutoISOMin = 100
						ExposureCompensation = 0.0
						Rate = ""
						ElectronicImageStabilization = "HS EIS"
						AudioSetting = "AUTO"
						FieldOfView = "Linear"
						DeviceName = "Highlights"
						TrackHeaderVersion = 0
						TrackCreateDate = "2024:03:24 21:30:52"
						TrackModifyDate = "2024:03:24 21:30:52"
						TrackID = 1
						TrackDuration = "0:23:52"
						TrackLayer = 0
						TrackVolume = "0.00%"
						ImageWidth = 5312
						ImageHeight = 2988
						GraphicsMode = "srcCopy"
						OpColor = "0 0 0"
						CompressorID = "hvc1"
						SourceImageWidth = 5312
						SourceImageHeight = 2988
						XResolution = 72
						YResolution = 72
						CompressorName = "GoPro H.265 encoder"
						BitDepth = 24
						VideoFrameRate = 59.94
						TimeCode = 3
						Balance = 0
						AudioFormat = "mp4a"
						AudioChannels = 2
						AudioBitsPerSample = 24
						AudioSampleRate = 48000
						TextFont = "Unknown (21)"
						TextFace = "Plain"
						TextSize = 10
						TextColor = "0 0 0"
						BackgroundColor = "65535 65535 65535"
						FontName = "Helvetica"
						OtherFormat = "tmcd"
						MatrixStructure = "1 0 0 0 1 0 0 0 1"
						MediaHeaderVersion = 0
						MediaCreateDate = "2024:03:24 21:30:52"
						MediaModifyDate = "2024:03:24 21:30:52"
						MediaTimeScale = 1000
						MediaDuration = "0:23:52"
						HandlerClass = "Media Handler"
						HandlerType = "NRT Metadata"
						HandlerDescription = "GoPro MET  "
						GenMediaVersion = 0
						GenFlags = "0 0 0"
						GenGraphicsMode = "srcCopy"
						GenOpColor = "0 0 0"
						GenBalance = 0
						MetaFormat = "gpmd"
						Warning = "[minor] The ExtractEmbedded option may find more tags in the media data"
						ImageSize = "5312x2988"
						Megapixels = 15.9
						AvgBitrate = "60 Mbps"
						Rotation = 0
					}
					@{
						SourceFile = "D:/wip/walks/2024-03-24/GX_0005_01.MP4"
						ExifToolVersion = 12.29
						FileName = "GX_0005_01.MP4"
						Directory = "D:/wip/walks/2024-03-24"
						FileSize = "11 GiB"
						FileModifyDate = "2024:03:24 17:46:19-04:00"
						FileAccessDate = "2024:03:24 18:38:39-04:00"
						FileCreateDate = "2024:03:24 18:36:38-04:00"
						FilePermissions = "-rw-rw-rw-"
						FileType = "MP4"
						FileTypeExtension = "mp4"
						MIMEType = "video/mp4"
						MajorBrand = "MP4 v1 [ISO 14496-1:ch13]"
						MinorVersion = "2013.10.18"
						CompatibleBrands = @(
							"mp41"
						)
						MediaDataSize = 11523143890
						MediaDataOffset = 36
						MovieHeaderVersion = 0
						CreateDate = "2024:03:24 22:20:40"
						ModifyDate = "2024:03:24 22:20:40"
						TimeScale = 60000
						Duration = "0:25:38"
						PreferredRate = 1
						PreferredVolume = "100.00%"
						PreviewTime = "0 s"
						PreviewDuration = "0 s"
						PosterTime = "0 s"
						SelectionTime = "0 s"
						SelectionDuration = "0 s"
						CurrentTime = "0 s"
						NextTrackID = 5
						LensSerialNumber = "LSU2061501400799"
						SerialNumberHash = "f2a4977be60c509ddbdfe8b18fd8cb15"
						MetadataVersion = "8.2.0"
						FirmwareVersion = "H22.01.02.20.00"
						CameraSerialNumber = "C3471325335652"
						Model = "HERO11 Black"
						AutoRotation = "Up"
						DigitalZoom = "Yes"
						ProTune = "On"
						WhiteBalance = "AUTO"
						Sharpness = "MED"
						ColorMode = "NATURAL"
						AutoISOMax = 3200
						AutoISOMin = 100
						ExposureCompensation = 0.0
						Rate = ""
						ElectronicImageStabilization = "HS EIS"
						AudioSetting = "AUTO"
						FieldOfView = "Linear"
						DeviceName = "Highlights"
						TrackHeaderVersion = 0
						TrackCreateDate = "2024:03:24 22:20:40"
						TrackModifyDate = "2024:03:24 22:20:40"
						TrackID = 1
						TrackDuration = "0:25:38"
						TrackLayer = 0
						TrackVolume = "0.00%"
						ImageWidth = 5312
						ImageHeight = 2988
						GraphicsMode = "srcCopy"
						OpColor = "0 0 0"
						CompressorID = "hvc1"
						SourceImageWidth = 5312
						SourceImageHeight = 2988
						XResolution = 72
						YResolution = 72
						CompressorName = "GoPro H.265 encoder"
						BitDepth = 24
						VideoFrameRate = 59.94
						TimeCode = 3
						Balance = 0
						AudioFormat = "mp4a"
						AudioChannels = 2
						AudioBitsPerSample = 24
						AudioSampleRate = 48000
						TextFont = "Unknown (21)"
						TextFace = "Plain"
						TextSize = 10
						TextColor = "0 0 0"
						BackgroundColor = "65535 65535 65535"
						FontName = "Helvetica"
						OtherFormat = "tmcd"
						MatrixStructure = "1 0 0 0 1 0 0 0 1"
						MediaHeaderVersion = 0
						MediaCreateDate = "2024:03:24 22:20:40"
						MediaModifyDate = "2024:03:24 22:20:40"
						MediaTimeScale = 1000
						MediaDuration = "0:25:38"
						HandlerClass = "Media Handler"
						HandlerType = "NRT Metadata"
						HandlerDescription = "GoPro MET  "
						GenMediaVersion = 0
						GenFlags = "0 0 0"
						GenGraphicsMode = "srcCopy"
						GenOpColor = "0 0 0"
						GenBalance = 0
						MetaFormat = "gpmd"
						Warning = "[minor] The ExtractEmbedded option may find more tags in the media data"
						ImageSize = "5312x2988"
						Megapixels = 15.9
						AvgBitrate = "60 Mbps"
						Rotation = 0
					}
					@{
						SourceFile = "D:/wip/walks/2024-03-24/GX_0005_02.MP4"
						ExifToolVersion = 12.29
						FileName = "GX_0005_02.MP4"
						Directory = "D:/wip/walks/2024-03-24"
						FileSize = "1663 MiB"
						FileModifyDate = "2024:03:24 17:50:12-04:00"
						FileAccessDate = "2024:03:24 18:40:50-04:00"
						FileCreateDate = "2024:03:24 18:40:32-04:00"
						FilePermissions = "-rw-rw-rw-"
						FileType = "MP4"
						FileTypeExtension = "mp4"
						MIMEType = "video/mp4"
						MajorBrand = "MP4 v1 [ISO 14496-1:ch13]"
						MinorVersion = "2013.10.18"
						CompatibleBrands = @(
							"mp41"
						)
						MediaDataSize = 1743870360
						MediaDataOffset = 36
						MovieHeaderVersion = 0
						CreateDate = "2024:03:24 22:20:40"
						ModifyDate = "2024:03:24 22:20:40"
						TimeScale = 60000
						Duration = "0:03:53"
						PreferredRate = 1
						PreferredVolume = "100.00%"
						PreviewTime = "0 s"
						PreviewDuration = "0 s"
						PosterTime = "0 s"
						SelectionTime = "0 s"
						SelectionDuration = "0 s"
						CurrentTime = "0 s"
						NextTrackID = 5
						LensSerialNumber = "LSU2061501400799"
						SerialNumberHash = "f2a4977be60c509ddbdfe8b18fd8cb15"
						MetadataVersion = "8.2.0"
						FirmwareVersion = "H22.01.02.20.00"
						CameraSerialNumber = "C3471325335652"
						Model = "HERO11 Black"
						AutoRotation = "Up"
						DigitalZoom = "Yes"
						ProTune = "On"
						WhiteBalance = "AUTO"
						Sharpness = "MED"
						ColorMode = "NATURAL"
						AutoISOMax = 3200
						AutoISOMin = 100
						ExposureCompensation = 0.0
						Rate = ""
						ElectronicImageStabilization = "HS EIS"
						AudioSetting = "AUTO"
						FieldOfView = "Linear"
						DeviceName = "Highlights"
						TrackHeaderVersion = 0
						TrackCreateDate = "2024:03:24 22:20:40"
						TrackModifyDate = "2024:03:24 22:20:40"
						TrackID = 1
						TrackDuration = "0:03:53"
						TrackLayer = 0
						TrackVolume = "0.00%"
						ImageWidth = 5312
						ImageHeight = 2988
						GraphicsMode = "srcCopy"
						OpColor = "0 0 0"
						CompressorID = "hvc1"
						SourceImageWidth = 5312
						SourceImageHeight = 2988
						XResolution = 72
						YResolution = 72
						CompressorName = "GoPro H.265 encoder"
						BitDepth = 24
						VideoFrameRate = 59.94
						TimeCode = 3
						Balance = 0
						AudioFormat = "mp4a"
						AudioChannels = 2
						AudioBitsPerSample = 24
						AudioSampleRate = 48000
						TextFont = "Unknown (21)"
						TextFace = "Plain"
						TextSize = 10
						TextColor = "0 0 0"
						BackgroundColor = "65535 65535 65535"
						FontName = "Helvetica"
						OtherFormat = "tmcd"
						MatrixStructure = "1 0 0 0 1 0 0 0 1"
						MediaHeaderVersion = 0
						MediaCreateDate = "2024:03:24 22:20:40"
						MediaModifyDate = "2024:03:24 22:20:40"
						MediaTimeScale = 1000
						MediaDuration = "0:03:53"
						HandlerClass = "Media Handler"
						HandlerType = "NRT Metadata"
						HandlerDescription = "GoPro MET  "
						GenMediaVersion = 0
						GenFlags = "0 0 0"
						GenGraphicsMode = "srcCopy"
						GenOpColor = "0 0 0"
						GenBalance = 0
						MetaFormat = "gpmd"
						Warning = "[minor] The ExtractEmbedded option may find more tags in the media data"
						ImageSize = "5312x2988"
						Megapixels = 15.9
						AvgBitrate = "59.9 Mbps"
						Rotation = 0
					}
				)
			}
		}

		It 'properly calculates every event trimmedStart value' {
			$result = & "$PSScriptRoot\Invoke-ConvertRawWalkTimestamps.ps1" -Date 2024-03-24 -SourceJson $testJson -ReturnData
			$firstEvent = $result.events[0]
			$sixtyFourthEvent = $result.events[63]

			$firstEvent.trimmedStart | Should -Be ([TimeSpan]"00:04:50.272" - [TimeSpan]"00:04:09.488").ToString().Substring(0, 12)
			$sixtyFourthEvent.trimmedStart | Should -Be ([TimeSpan]"01:03:27.966" - [TimeSpan]"00:04:09.488" - [TimeSpan]"00:00:18").ToString().Substring(0, 12)
		}
	}
}

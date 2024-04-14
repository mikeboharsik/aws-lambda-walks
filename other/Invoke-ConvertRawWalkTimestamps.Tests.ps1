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

Describe 'Invoke-ConvertRawWalkTimestamps' {
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

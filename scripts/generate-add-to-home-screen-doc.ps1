param(
    [string]$OutputDocx = (Join-Path $PSScriptRoot "..\Add-To-Home-Screen-Guide-zh-CN.docx")
)

$ErrorActionPreference = "Stop"

Add-Type -AssemblyName System.Drawing

$root = Split-Path -Parent $PSScriptRoot
$assetDir = Join-Path $root "docs-assets"
if (-not (Test-Path $assetDir)) {
    New-Item -ItemType Directory -Path $assetDir | Out-Null
}

function New-Brush($hex) {
    return [System.Drawing.SolidBrush]::new([System.Drawing.ColorTranslator]::FromHtml($hex))
}

function New-Pen($hex, [float]$width = 1) {
    return [System.Drawing.Pen]::new([System.Drawing.ColorTranslator]::FromHtml($hex), $width)
}

function Draw-RoundedRectangle {
    param(
        [System.Drawing.Graphics]$Graphics,
        [System.Drawing.Pen]$Pen,
        [System.Drawing.Brush]$Brush,
        [float]$X,
        [float]$Y,
        [float]$Width,
        [float]$Height,
        [float]$Radius
    )

    $diameter = $Radius * 2
    $path = [System.Drawing.Drawing2D.GraphicsPath]::new()
    $path.AddArc($X, $Y, $diameter, $diameter, 180, 90)
    $path.AddArc($X + $Width - $diameter, $Y, $diameter, $diameter, 270, 90)
    $path.AddArc($X + $Width - $diameter, $Y + $Height - $diameter, $diameter, $diameter, 0, 90)
    $path.AddArc($X, $Y + $Height - $diameter, $diameter, $diameter, 90, 90)
    $path.CloseFigure()

    if ($Brush) {
        $Graphics.FillPath($Brush, $path)
    }
    if ($Pen) {
        $Graphics.DrawPath($Pen, $path)
    }

    $path.Dispose()
}

function Draw-TextBlock {
    param(
        [System.Drawing.Graphics]$Graphics,
        [string]$Text,
        [string]$FontName,
        [float]$FontSize,
        [string]$ColorHex,
        [float]$X,
        [float]$Y,
        [float]$Width,
        [float]$Height,
        [System.Drawing.FontStyle]$Style = [System.Drawing.FontStyle]::Regular,
        [System.Drawing.StringAlignment]$Alignment = [System.Drawing.StringAlignment]::Near
    )

    $font = [System.Drawing.Font]::new($FontName, $FontSize, $Style)
    $brush = New-Brush $ColorHex
    $format = [System.Drawing.StringFormat]::new()
    $format.Alignment = $Alignment
    $format.LineAlignment = [System.Drawing.StringAlignment]::Near
    $Graphics.DrawString($Text, $font, $brush, [System.Drawing.RectangleF]::new($X, $Y, $Width, $Height), $format)
    $format.Dispose()
    $brush.Dispose()
    $font.Dispose()
}

function Draw-StepBadge {
    param(
        [System.Drawing.Graphics]$Graphics,
        [string]$Number,
        [float]$CenterX,
        [float]$CenterY,
        [string]$FillHex = "#2F80ED"
    )

    $diameter = 54
    $brush = New-Brush $FillHex
    $pen = New-Pen "#FFFFFF" 3
    $font = [System.Drawing.Font]::new("Microsoft YaHei", 20, [System.Drawing.FontStyle]::Bold)
    $textBrush = New-Brush "#FFFFFF"
    $fmt = [System.Drawing.StringFormat]::new()
    $fmt.Alignment = [System.Drawing.StringAlignment]::Center
    $fmt.LineAlignment = [System.Drawing.StringAlignment]::Center

    $rect = [System.Drawing.RectangleF]::new($CenterX - $diameter / 2, $CenterY - $diameter / 2, $diameter, $diameter)
    $Graphics.FillEllipse($brush, $rect)
    $Graphics.DrawEllipse($pen, $rect)
    $Graphics.DrawString($Number, $font, $textBrush, $rect, $fmt)

    $fmt.Dispose()
    $textBrush.Dispose()
    $font.Dispose()
    $pen.Dispose()
    $brush.Dispose()
}

function Draw-Arrow {
    param(
        [System.Drawing.Graphics]$Graphics,
        [float]$FromX,
        [float]$FromY,
        [float]$ToX,
        [float]$ToY,
        [string]$ColorHex = "#2F80ED"
    )

    $pen = New-Pen $ColorHex 5
    $pen.EndCap = [System.Drawing.Drawing2D.LineCap]::ArrowAnchor
    $Graphics.DrawLine($pen, $FromX, $FromY, $ToX, $ToY)
    $pen.Dispose()
}

function New-GuideCanvas {
    param([string]$Path)

    $bmp = [System.Drawing.Bitmap]::new(1440, 900)
    $graphics = [System.Drawing.Graphics]::FromImage($bmp)
    $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $graphics.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit
    $graphics.Clear([System.Drawing.ColorTranslator]::FromHtml("#F6F8FB"))

    return @{
        Bitmap = $bmp
        Graphics = $graphics
        Path = $Path
    }
}

function Save-GuideCanvas {
    param($Canvas)
    $Canvas.Bitmap.Save($Canvas.Path, [System.Drawing.Imaging.ImageFormat]::Png)
    $Canvas.Graphics.Dispose()
    $Canvas.Bitmap.Dispose()
}

function Draw-HeaderBand {
    param(
        [System.Drawing.Graphics]$Graphics,
        [string]$Title,
        [string]$Subtitle
    )

    $headerBrush = New-Brush "#10243E"
    $subBrush = New-Brush "#5AA9E6"
    Draw-RoundedRectangle -Graphics $Graphics -Pen $null -Brush $headerBrush -X 48 -Y 36 -Width 1344 -Height 120 -Radius 32
    Draw-TextBlock -Graphics $Graphics -Text $Title -FontName "Microsoft YaHei" -FontSize 26 -ColorHex "#FFFFFF" -X 90 -Y 60 -Width 1000 -Height 40 -Style Bold
    Draw-TextBlock -Graphics $Graphics -Text $Subtitle -FontName "Microsoft YaHei" -FontSize 14 -ColorHex "#D8E6F8" -X 90 -Y 100 -Width 1100 -Height 28
    $headerBrush.Dispose()
    $subBrush.Dispose()
}

function New-IpadGuideImage {
    param([string]$Path)

    $canvas = New-GuideCanvas -Path $Path
    $g = $canvas.Graphics

    Draw-HeaderBand -Graphics $g -Title "iPad 添加到主屏幕示意图" -Subtitle "推荐使用 Safari 打开网页，再通过分享菜单添加到桌面。"

    $devicePen = New-Pen "#1E2A3A" 6
    $deviceBrush = New-Brush "#0F1722"
    Draw-RoundedRectangle -Graphics $g -Pen $devicePen -Brush $deviceBrush -X 120 -Y 190 -Width 760 -Height 640 -Radius 48

    $screenBrush = New-Brush "#FFFFFF"
    Draw-RoundedRectangle -Graphics $g -Pen $null -Brush $screenBrush -X 155 -Y 225 -Width 690 -Height 570 -Radius 28

    $barBrush = New-Brush "#EAF0F6"
    Draw-RoundedRectangle -Graphics $g -Pen $null -Brush $barBrush -X 185 -Y 255 -Width 630 -Height 56 -Radius 18
    Draw-TextBlock -Graphics $g -Text "https://示例网址" -FontName "Microsoft YaHei" -FontSize 16 -ColorHex "#506176" -X 220 -Y 272 -Width 380 -Height 24
    Draw-TextBlock -Graphics $g -Text "分享" -FontName "Microsoft YaHei" -FontSize 16 -ColorHex "#2F80ED" -X 710 -Y 270 -Width 70 -Height 24 -Style Bold -Alignment Center

    $panelBrush = New-Brush "#F6F9FC"
    $panelPen = New-Pen "#D6E0EA" 2
    Draw-RoundedRectangle -Graphics $g -Pen $panelPen -Brush $panelBrush -X 540 -Y 340 -Width 230 -Height 240 -Radius 22

    $menuItems = @(
        @{ Text = "复制"; Y = 368; Color = "#425466" },
        @{ Text = "加入书签"; Y = 416; Color = "#425466" },
        @{ Text = "添加到主屏幕"; Y = 464; Color = "#0B7A75"; Highlight = $true },
        @{ Text = "打印"; Y = 512; Color = "#425466" }
    )
    foreach ($item in $menuItems) {
        if ($item.Highlight) {
            $hlBrush = New-Brush "#DFF5EE"
            Draw-RoundedRectangle -Graphics $g -Pen $null -Brush $hlBrush -X 556 -Y ($item.Y - 8) -Width 198 -Height 38 -Radius 14
            $hlBrush.Dispose()
        }
        Draw-TextBlock -Graphics $g -Text $item.Text -FontName "Microsoft YaHei" -FontSize 15 -ColorHex $item.Color -X 576 -Y $item.Y -Width 160 -Height 24
    }

    Draw-StepBadge -Graphics $g -Number "1" -CenterX 760 -CenterY 282
    Draw-Arrow -Graphics $g -FromX 952 -FromY 245 -ToX 802 -ToY 280
    Draw-TextBlock -Graphics $g -Text "点击 Safari 右上角的分享按钮" -FontName "Microsoft YaHei" -FontSize 18 -ColorHex "#183B56" -X 968 -Y 210 -Width 350 -Height 70 -Style Bold

    Draw-StepBadge -Graphics $g -Number "2" -CenterX 520 -CenterY 484 -FillHex "#27AE60"
    Draw-Arrow -Graphics $g -FromX 968 -FromY 430 -ToX 550 -ToY 484 -ColorHex "#27AE60"
    Draw-TextBlock -Graphics $g -Text "在弹出菜单中选择《添加到主屏幕》" -FontName "Microsoft YaHei" -FontSize 18 -ColorHex "#183B56" -X 968 -Y 390 -Width 360 -Height 80 -Style Bold

    Draw-StepBadge -Graphics $g -Number "3" -CenterX 360 -CenterY 730 -FillHex "#F2994A"
    Draw-Arrow -Graphics $g -FromX 968 -FromY 620 -ToX 420 -ToY 730 -ColorHex "#F2994A"
    Draw-TextBlock -Graphics $g -Text "点击《添加》后，桌面就会出现网页图标" -FontName "Microsoft YaHei" -FontSize 18 -ColorHex "#183B56" -X 968 -Y 580 -Width 360 -Height 90 -Style Bold

    Draw-TextBlock -Graphics $g -Text "温馨提示：建议由老师或家长先完成一次添加，并把图标放到桌面第一页。" -FontName "Microsoft YaHei" -FontSize 16 -ColorHex "#425466" -X 160 -Y 812 -Width 1040 -Height 40

    $devicePen.Dispose()
    $deviceBrush.Dispose()
    $screenBrush.Dispose()
    $barBrush.Dispose()
    $panelBrush.Dispose()
    $panelPen.Dispose()

    Save-GuideCanvas -Canvas $canvas
}

function New-AndroidGuideImage {
    param([string]$Path)

    $canvas = New-GuideCanvas -Path $Path
    $g = $canvas.Graphics

    Draw-HeaderBand -Graphics $g -Title "Android 平板添加到桌面示意图" -Subtitle "推荐使用 Chrome 打开网页，再通过右上角菜单添加到主屏幕。"

    $devicePen = New-Pen "#202938" 6
    $deviceBrush = New-Brush "#121A24"
    Draw-RoundedRectangle -Graphics $g -Pen $devicePen -Brush $deviceBrush -X 120 -Y 190 -Width 760 -Height 640 -Radius 48

    $screenBrush = New-Brush "#FFFFFF"
    Draw-RoundedRectangle -Graphics $g -Pen $null -Brush $screenBrush -X 155 -Y 225 -Width 690 -Height 570 -Radius 28

    $barBrush = New-Brush "#EEF3F8"
    Draw-RoundedRectangle -Graphics $g -Pen $null -Brush $barBrush -X 185 -Y 255 -Width 630 -Height 56 -Radius 18
    Draw-TextBlock -Graphics $g -Text "https://示例网址" -FontName "Microsoft YaHei" -FontSize 16 -ColorHex "#506176" -X 220 -Y 272 -Width 360 -Height 24
    Draw-TextBlock -Graphics $g -Text "⋮" -FontName "Microsoft YaHei" -FontSize 22 -ColorHex "#183B56" -X 730 -Y 262 -Width 50 -Height 30 -Style Bold -Alignment Center

    $panelBrush = New-Brush "#FFFFFF"
    $panelPen = New-Pen "#D6E0EA" 2
    Draw-RoundedRectangle -Graphics $g -Pen $panelPen -Brush $panelBrush -X 560 -Y 330 -Width 220 -Height 250 -Radius 20

    $menuItems = @(
        @{ Text = "刷新"; Y = 356; Color = "#425466" },
        @{ Text = "分享"; Y = 404; Color = "#425466" },
        @{ Text = "添加到主屏幕"; Y = 452; Color = "#0B7A75"; Highlight = $true },
        @{ Text = "安装应用"; Y = 500; Color = "#2F80ED"; Highlight = $false }
    )
    foreach ($item in $menuItems) {
        if ($item.Highlight) {
            $hlBrush = New-Brush "#E6F4FF"
            Draw-RoundedRectangle -Graphics $g -Pen $null -Brush $hlBrush -X 576 -Y ($item.Y - 8) -Width 188 -Height 38 -Radius 14
            $hlBrush.Dispose()
        }
        Draw-TextBlock -Graphics $g -Text $item.Text -FontName "Microsoft YaHei" -FontSize 15 -ColorHex $item.Color -X 596 -Y $item.Y -Width 150 -Height 24
    }

    Draw-StepBadge -Graphics $g -Number "1" -CenterX 758 -CenterY 282
    Draw-Arrow -Graphics $g -FromX 968 -FromY 242 -ToX 800 -ToY 282
    Draw-TextBlock -Graphics $g -Text "点击 Chrome 右上角《三点》菜单" -FontName "Microsoft YaHei" -FontSize 18 -ColorHex "#183B56" -X 968 -Y 208 -Width 330 -Height 70 -Style Bold

    Draw-StepBadge -Graphics $g -Number "2" -CenterX 540 -CenterY 470 -FillHex "#27AE60"
    Draw-Arrow -Graphics $g -FromX 968 -FromY 430 -ToX 570 -ToY 470 -ColorHex "#27AE60"
    Draw-TextBlock -Graphics $g -Text "选择《添加到主屏幕》；部分设备会显示《安装应用》" -FontName "Microsoft YaHei" -FontSize 18 -ColorHex "#183B56" -X 968 -Y 386 -Width 360 -Height 100 -Style Bold

    Draw-StepBadge -Graphics $g -Number "3" -CenterX 360 -CenterY 730 -FillHex "#F2994A"
    Draw-Arrow -Graphics $g -FromX 968 -FromY 618 -ToX 420 -ToY 730 -ColorHex "#F2994A"
    Draw-TextBlock -Graphics $g -Text "确认《添加》或《安装》后，桌面会出现图标" -FontName "Microsoft YaHei" -FontSize 18 -ColorHex "#183B56" -X 968 -Y 572 -Width 360 -Height 90 -Style Bold

    Draw-TextBlock -Graphics $g -Text "温馨提示：建议优先使用 Chrome 打开网页，添加后把图标拖到桌面首页。" -FontName "Microsoft YaHei" -FontSize 16 -ColorHex "#425466" -X 160 -Y 812 -Width 1040 -Height 40

    $devicePen.Dispose()
    $deviceBrush.Dispose()
    $screenBrush.Dispose()
    $barBrush.Dispose()
    $panelBrush.Dispose()
    $panelPen.Dispose()

    Save-GuideCanvas -Canvas $canvas
}

function Add-Paragraph {
    param(
        $Document,
        [string]$Text,
        [int]$Style = 0,
        [int]$Size = 11,
        [int]$Bold = 0,
        [int]$Color = 0
    )

    $paragraph = $Document.Content.Paragraphs.Add()
    if ($Style -ne 0) {
        $paragraph.Range.set_Style($Style) | Out-Null
    }
    $paragraph.Range.Text = $Text
    $paragraph.Range.Font.Size = $Size
    $paragraph.Range.Font.Bold = $Bold
    if ($Color -ne 0) {
        $paragraph.Range.Font.Color = $Color
    }
    $paragraph.Range.InsertParagraphAfter() | Out-Null
    return $paragraph
}

function Add-NumberedList {
    param(
        $Document,
        [string[]]$Items
    )

    $first = $null
    foreach ($item in $Items) {
        $paragraph = $Document.Content.Paragraphs.Add()
        $paragraph.Range.Text = $item
        $paragraph.Range.Font.Size = 11
        $paragraph.Range.InsertParagraphAfter() | Out-Null
        if (-not $first) {
            $first = $paragraph
        }
        $paragraph.Range.ListFormat.ApplyNumberDefault() | Out-Null
    }
    return $first
}

$ipadImage = Join-Path $assetDir "ipad-add-to-home.png"
$androidImage = Join-Path $assetDir "android-add-to-home.png"

New-IpadGuideImage -Path $ipadImage
New-AndroidGuideImage -Path $androidImage

$word = $null
$document = $null

try {
    $word = New-Object -ComObject Word.Application
    $word.Visible = $false
    $document = $word.Documents.Add()

    $selection = $word.Selection

    $selection.Font.Name = "Microsoft YaHei"
    $selection.Font.Size = 20
    $selection.Font.Bold = 1
    $selection.TypeText("将当前网页添加到平板桌面操作说明")
    $selection.TypeParagraph()

    $selection.Font.Name = "Microsoft YaHei"
    $selection.Font.Size = 11
    $selection.Font.Bold = 0
    $selection.TypeText("适用对象：老师、家长。建议先由成人完成添加，后续幼儿只需点击桌面图标进入。")
    $selection.TypeParagraph()
    $selection.TypeText("适用设备：iPad（Safari）和 Android 平板（Chrome）。")
    $selection.TypeParagraph()
    $selection.TypeParagraph()

    $selection.Font.Name = "Microsoft YaHei"
    $selection.Font.Size = 15
    $selection.Font.Bold = 1
    $selection.TypeText("一、iPad 添加到主屏幕")
    $selection.TypeParagraph()
    $selection.Font.Size = 11
    $selection.Font.Bold = 0

    $selection.InlineShapes.AddPicture($ipadImage) | Out-Null
    $selection.TypeParagraph()
    $selection.TypeText("操作步骤：")
    $selection.TypeParagraph()
    $selection.Range.ListFormat.ApplyNumberDefault() | Out-Null
    $selection.TypeText("用 Safari 打开老师提供的网址。")
    $selection.TypeParagraph()
    $selection.TypeText('点击右上角《分享》按钮。')
    $selection.TypeParagraph()
    $selection.TypeText('在弹出的菜单中选择《添加到主屏幕》。')
    $selection.TypeParagraph()
    $selection.TypeText('如有《作为网页 App 打开》选项，建议保持开启。')
    $selection.TypeParagraph()
    $selection.TypeText('点击《添加》，回到桌面后即可看到图标。')
    $selection.TypeParagraph()
    $selection.Range.ListFormat.RemoveNumbers() | Out-Null
    $selection.TypeText("建议：把图标拖到桌面第一页，方便孩子找到。")
    $selection.TypeParagraph()
    $selection.TypeParagraph()

    $selection.Font.Name = "Microsoft YaHei"
    $selection.Font.Size = 15
    $selection.Font.Bold = 1
    $selection.TypeText("二、Android 平板添加到桌面")
    $selection.TypeParagraph()
    $selection.Font.Size = 11
    $selection.Font.Bold = 0

    $selection.InlineShapes.AddPicture($androidImage) | Out-Null
    $selection.TypeParagraph()
    $selection.TypeText("操作步骤：")
    $selection.TypeParagraph()
    $selection.Range.ListFormat.ApplyNumberDefault() | Out-Null
    $selection.TypeText("用 Chrome 打开老师提供的网址。")
    $selection.TypeParagraph()
    $selection.TypeText('点击右上角《三点》菜单。')
    $selection.TypeParagraph()
    $selection.TypeText('选择《添加到主屏幕》或《安装应用》。')
    $selection.TypeParagraph()
    $selection.TypeText('点击《添加》或《安装》，回到桌面后查看图标。')
    $selection.TypeParagraph()
    $selection.Range.ListFormat.RemoveNumbers() | Out-Null
    $selection.TypeText("建议：优先使用 Chrome，并把图标拖到桌面首页。")
    $selection.TypeParagraph()
    $selection.TypeParagraph()

    $selection.Font.Name = "Microsoft YaHei"
    $selection.Font.Size = 15
    $selection.Font.Bold = 1
    $selection.TypeText("三、常见问题")
    $selection.TypeParagraph()
    $selection.Font.Size = 11
    $selection.Font.Bold = 0
    $selection.TypeText('1. 找不到《添加到主屏幕》：请确认 iPad 使用 Safari、Android 使用 Chrome。')
    $selection.TypeParagraph()
    $selection.TypeText("2. 添加后打不开：先确认网络正常，再从桌面图标重新进入一次。")
    $selection.TypeParagraph()
    $selection.TypeText("3. 删除图标会不会影响网页：不会，删除的只是桌面快捷方式。")
    $selection.TypeParagraph()
    $selection.TypeParagraph()

    $selection.Font.Name = "Microsoft YaHei"
    $selection.Font.Size = 15
    $selection.Font.Bold = 1
    $selection.TypeText("四、家长转发版简短文案")
    $selection.TypeParagraph()
    $selection.Font.Size = 11
    $selection.Font.Bold = 0
    $selection.TypeText('请家长帮孩子先操作一次，后续孩子直接点击桌面图标进入即可。iPad 请用 Safari 打开网址，点击《分享》后选择《添加到主屏幕》；Android 平板请用 Chrome 打开网址，点击右上角《三点》，选择《添加到主屏幕》或《安装应用》。建议把图标拖到桌面首页，方便孩子找到。')
    $selection.TypeParagraph()

    $outputPath = [System.IO.Path]::GetFullPath($OutputDocx)
    $document.SaveAs([ref]$outputPath)
}
finally {
    if ($document) {
        $document.Close()
        [System.Runtime.InteropServices.Marshal]::ReleaseComObject($document) | Out-Null
    }
    if ($word) {
        $word.Quit()
        [System.Runtime.InteropServices.Marshal]::ReleaseComObject($word) | Out-Null
    }
    [GC]::Collect()
    [GC]::WaitForPendingFinalizers()
}

Write-Output ("Generated: " + [System.IO.Path]::GetFullPath($OutputDocx))


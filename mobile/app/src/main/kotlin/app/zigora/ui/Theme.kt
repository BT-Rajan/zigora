package app.zigora.ui

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.Font
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextDirection
import androidx.compose.ui.unit.em
import androidx.compose.ui.unit.sp
import androidx.compose.material3.Typography
import app.zigora.R

// Calm blue: light, quiet and easy on the eyes for long reading. Text on its background 17:1; the blue on white 5.2:1 (both pass WCAG AA).
val Blue = Color(0xFF2563EB)      // buttons, links, selected things
val Amber = Color(0xFFF59E0B)     // a little warmth: streaks, highlights
val Ink = Color(0xFF0F172A)       // text
val Slate = Color(0xFF475569)     // quieter text
val Paper = Color(0xFFF8FAFC)     // the page
private val Light = lightColorScheme(
    primary = Blue, onPrimary = Color.White, primaryContainer = Color(0xFFDBEAFE), onPrimaryContainer = Color(0xFF1E3A8A),
    secondary = Slate, onSecondary = Color.White, secondaryContainer = Color(0xFFE2E8F0), onSecondaryContainer = Ink,
    tertiary = Color(0xFFB45309), onTertiary = Color.White, tertiaryContainer = Color(0xFFFEF3C7), onTertiaryContainer = Color(0xFF78350F),
    background = Paper, onBackground = Ink, surface = Paper, onSurface = Ink, surfaceVariant = Color(0xFFE2E8F0), onSurfaceVariant = Slate,
    surfaceContainerLowest = Color.White, surfaceContainerLow = Color.White, surfaceContainer = Color.White, surfaceContainerHigh = Color(0xFFF1F5F9), surfaceContainerHighest = Color(0xFFE2E8F0),
    outline = Color(0xFF94A3B8), outlineVariant = Color(0xFFE2E8F0), error = Color(0xFFB91C1C), errorContainer = Color(0xFFFEE2E2), onErrorContainer = Color(0xFF7F1D1D),
)
private val Dark = darkColorScheme(  // only when the student picks Dark in Me: soft slate, not black, so it is easy on the eyes too
    primary = Color(0xFF93C5FD), onPrimary = Color(0xFF0B2A5B), primaryContainer = Color(0xFF1E3A8A), onPrimaryContainer = Color(0xFFDBEAFE),
    secondary = Color(0xFFCBD5E1), onSecondary = Color(0xFF1E293B), secondaryContainer = Color(0xFF334155), onSecondaryContainer = Color(0xFFE2E8F0),
    tertiary = Color(0xFFFBBF24), onTertiary = Color(0xFF451A03), tertiaryContainer = Color(0xFF78350F), onTertiaryContainer = Color(0xFFFEF3C7),
    background = Color(0xFF0F172A), onBackground = Color(0xFFE2E8F0), surface = Color(0xFF0F172A), onSurface = Color(0xFFE2E8F0), onSurfaceVariant = Color(0xFF94A3B8),
    surfaceContainerLowest = Color(0xFF0B1220), surfaceContainerLow = Color(0xFF162033), surfaceContainer = Color(0xFF1E293B), surfaceContainerHigh = Color(0xFF273449), surfaceContainerHighest = Color(0xFF334155),
    outline = Color(0xFF64748B), outlineVariant = Color(0xFF334155),
)

/** the web's heading face (Instrument Sans) for headings and titles; body text and labels in the phone's own font, as the web does.
 *  One scale for every screen: screens pick a role from here and never set a size of their own. */
private val Heading = FontFamily(Font(R.font.instrument_sans_600, FontWeight.SemiBold), Font(R.font.instrument_sans_700, FontWeight.Bold))
// each paragraph takes its direction from its own words: an English topic inside the Arabic app keeps its full stops where they belong
private fun h(size: Int, line: Int, w: FontWeight = FontWeight.SemiBold) = TextStyle(fontFamily = Heading, fontWeight = w, fontSize = size.sp, lineHeight = line.sp,
    letterSpacing = (-0.01).em, textDirection = TextDirection.Content)
private fun b(size: Int, line: Int, w: FontWeight = FontWeight.Normal, track: Double = 0.0) = TextStyle(fontWeight = w, fontSize = size.sp, lineHeight = line.sp,
    letterSpacing = track.em, textDirection = TextDirection.Content)
val ZigoraType = Typography(
    displaySmall = h(32, 40, FontWeight.Bold), headlineLarge = h(28, 36, FontWeight.Bold), headlineMedium = h(26, 32), headlineSmall = h(22, 28),
    titleLarge = h(20, 26), titleMedium = h(17, 23), titleSmall = h(15, 20),
    bodyLarge = b(16, 24), bodyMedium = b(14, 20), bodySmall = b(12, 16),
    labelLarge = b(14, 20, FontWeight.Medium), labelMedium = b(12, 16, FontWeight.Medium, 0.01), labelSmall = b(11, 16, FontWeight.Medium, 0.02),
)

/** Zigora's Calm blue, light unless the student picks Dark in Me. The phone's wallpaper colours and its dark mode are no longer followed:
 *  the app looks the same, and stays readable, on every phone. (wallpaper is kept in the call for older saved settings; it is ignored.) */
@Composable
fun ZigoraTheme(@Suppress("UNUSED_PARAMETER") wallpaper: Boolean, theme: String = "light", content: @Composable () -> Unit) {
    MaterialTheme(colorScheme = if (theme == "dark") Dark else Light, typography = ZigoraType, content = content)
}

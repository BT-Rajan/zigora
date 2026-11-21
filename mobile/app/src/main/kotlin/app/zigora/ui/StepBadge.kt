package app.zigora.ui

import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.Description
import androidx.compose.material.icons.outlined.Lightbulb
import androidx.compose.material.icons.outlined.QuestionMark
import androidx.compose.material.icons.outlined.Schema
import androidx.compose.material.icons.outlined.School
import androidx.compose.material.icons.outlined.Science
import androidx.compose.material.icons.outlined.TaskAlt
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.lerp
import androidx.compose.ui.graphics.luminance
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp

/** the colour of each kind of step, the same as on the website: the gist blue, Why? amber, Example green, Exam angle violet, Quick check teal */
fun stepColor(k: String, dark: Boolean): Color {
    val c = when (k) {
        "why" -> Color(0xFFB45309); "example" -> Color(0xFF15803D); "exam" -> Color(0xFF7C3AED); "check" -> Color(0xFF0E7490)
        "diagram" -> Color(0xFFC2410C); "notes" -> Color(0xFF475569); "simpler" -> Color(0xFFB45309); else -> Color(0xFF2563EB)
    }
    return if (dark) lerp(c, Color.White, 0.45f) else c
}

/** A step's name as a label, not a button: a soft coloured badge with its icon ("The gist", "Why?", "Diagram"), so it reads as the heading of what follows. */
@Composable
fun StepBadge(k: String, label: String, modifier: Modifier = Modifier) {
    val dark = MaterialTheme.colorScheme.surface.luminance() < 0.5f
    val c = stepColor(k, dark)
    Surface(modifier, color = c.copy(alpha = if (dark) 0.18f else 0.11f), shape = RoundedCornerShape(50)) {
        Row(Modifier.padding(horizontal = 12.dp, vertical = 5.dp), verticalAlignment = Alignment.CenterVertically) {
            Icon(when (k) {
                "why", "simpler" -> Icons.Outlined.QuestionMark; "example" -> Icons.Outlined.Science; "exam" -> Icons.Outlined.School
                "check" -> Icons.Outlined.TaskAlt; "diagram" -> Icons.Outlined.Schema; "notes" -> Icons.Outlined.Description; else -> Icons.Outlined.Lightbulb
            }, null, Modifier.size(16.dp), tint = c)
            Spacer(Modifier.width(6.dp))
            Text(label, style = MaterialTheme.typography.labelLarge, color = c, fontWeight = FontWeight.SemiBold)
        }
    }
}

package app.zigora.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Button
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import app.zigora.data.I18n
import app.zigora.data.Offer
import app.zigora.data.OfferList
import kotlinx.coroutines.launch
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put

// Courses a teacher offers, for a student: invitations to accept within 48 hours, and courses to join at once or ask to join (the teacher
// decides within 48 hours). A course they are in shows under My courses like any other.

private fun hoursLeft(iso: String?): String = iso?.let {
    val h = ((java.time.Instant.parse(it).toEpochMilli() - System.currentTimeMillis()) / 3_600_000L).coerceAtLeast(0)
    if (h < 1) tl("less than an hour left") else if (h == 1L) tl("1 hour left") else tl("{n} hours left", "n" to h)
}.orEmpty()
private fun datesOf(c: Offer) = if (c.starts_on == null && c.ends_on == null) tl("No fixed dates")
    else listOfNotNull(c.starts_on?.let { tl("from {date}", "date" to day(it)) }, c.ends_on?.let { tl("to {date}", "date" to day(it)) }).joinToString(" ")

/** Home: an invitation to a course, a tap from answering it */
@Composable
fun CourseInvitesCard(openJoin: () -> Unit) {
    val l = rememberLoad("course-invites") { runCatching { get("/offered/catalog", OfferList.serializer()) }.getOrDefault(OfferList()) }
    val d = (l.state as? Load.Ok)?.value ?: return
    d.invited.forEach { c -> ListRow(tl("{teacher} invited you to {course}", "teacher" to c.teacher, "course" to c.name), tl("Accept or decline") + " · " + hoursLeft(c.expires_at), onClick = openJoin) }
}

@Composable
fun JoinScreen(back: () -> Unit, openCourse: (Int) -> Unit) {
    val a = api(); val scope = rememberCoroutineScope()
    val l = rememberLoad("catalog") { get("/offered/catalog", OfferList.serializer()) }
    var busy by remember { mutableIntStateOf(0) }
    var msg by remember { mutableStateOf("") }
    var leaving by remember { mutableStateOf<Offer?>(null) }
    fun run(c: Offer, block: suspend () -> Unit) = scope.launch { busy = c.id; msg = ""; try { block(); l.reload() } catch (e: Exception) { msg = I18n.srv(e.message) }; busy = 0 }
    leaving?.let { c ->
        androidx.compose.material3.AlertDialog(onDismissRequest = { leaving = null }, title = { Text(tl("Leave {course}?", "course" to c.name)) },
            text = { Text(tl("It goes from your courses. Your work so far is kept; you can ask to join again later.")) },
            confirmButton = { androidx.compose.material3.TextButton(onClick = { leaving = null; run(c) { a.raw("POST", "/enrolments/${c.enrolment}", buildJsonObject { put("action", "leave") }); msg = tl("You have left the course") } }) { Text(tl("Leave")) } },
            dismissButton = { androidx.compose.material3.TextButton(onClick = { leaving = null }) { Text(androidx.compose.ui.res.stringResource(app.zigora.R.string.cancel)) } })
    }
    Page(tl("Join a course"), back = back) {
        if (msg.isNotEmpty()) Text(msg, color = MaterialTheme.colorScheme.primary)
        Loaded(l) { d ->
            if (d.invited.isNotEmpty()) {
                SectionTitle(tl("You're invited"))
                d.invited.forEach { c ->
                    Panel {
                        Text(c.name, style = MaterialTheme.typography.titleMedium)
                        Quiet(listOf(c.teacher, datesOf(c), hoursLeft(c.expires_at)).filter { it.isNotEmpty() }.joinToString(" · "))
                        if (c.about.isNotEmpty()) MathMd(c.about)
                        Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.padding(top = 8.dp)) {
                            Button(enabled = busy != c.id, onClick = { run(c) { a.raw("POST", "/enrolments/${c.enrolment}", buildJsonObject { put("action", "accept") }); msg = tl("You're in. It is in your courses.") } }) { Text(tl("Accept")) }
                            OutlinedButton(enabled = busy != c.id, onClick = { run(c) { a.raw("POST", "/enrolments/${c.enrolment}", buildJsonObject { put("action", "decline") }) } }) { Text(tl("Decline")) }
                        }
                    }
                }
            }
            val on = setOf("active", "completed", "suspended", "applied")  // the courses they are on (or asked for), apart from the ones they could join
            val mine = d.items.filter { it.mine in on }; val others = d.items.filter { it.mine != "invited" && it.mine !in on }
            val card = @Composable { c: Offer ->
                Panel {
                    Text(c.name, style = MaterialTheme.typography.titleMedium)
                    Quiet(listOf(c.teacher, datesOf(c), pl(c.topics, "topic")).filter { it.isNotEmpty() }.joinToString(" · "))
                    if (c.about.isNotEmpty()) MathMd(c.about)
                    when (c.mine) {
                        "active", "completed" -> Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.padding(top = 8.dp)) {
                            if (c.state != "paused") OutlinedButton(onClick = { openCourse(c.id) }) { Text(tl("Open")) }
                            if (c.mine == "active") androidx.compose.material3.TextButton(enabled = busy != c.id, onClick = { leaving = c }) { Text(tl("Leave the course")) }
                        }
                        "applied" -> Column(Modifier.padding(top = 8.dp)) {
                            Quiet(tl("You asked to join. Your teacher has 48 hours to decide.") + " (" + hoursLeft(c.expires_at) + ") " + tl("If they don't answer in time, the request lapses and you can ask again."))
                            androidx.compose.material3.TextButton(enabled = busy != c.id, onClick = { run(c) {
                                a.raw("POST", "/enrolments/${c.enrolment}", buildJsonObject { put("action", "withdraw") }); msg = tl("Request withdrawn")
                            } }) { Text(tl("Withdraw my request")) }
                        }
                        "suspended" -> Quiet(tl("Your place is on hold. Ask your teacher."), Modifier.padding(top = 8.dp))
                        else -> Button(enabled = busy != c.id, modifier = Modifier.padding(top = 8.dp), onClick = { run(c) {
                            val r = a.send("POST", "/offered/${c.id}/join", null, Offer.serializer())
                            msg = if (r.mine == "active") tl("You're in. It is in your courses.") else tl("Asked. Your teacher has 48 hours to decide.")
                        } }) { Text(if (c.access == "open") tl("Join") else tl("Ask to join")) }
                    }
                }
            }
            if (mine.isNotEmpty()) { SectionTitle(tl("Your offered courses")); Paged(mine, "mine") { card(it) } }
            SectionTitle(tl("Courses you can join"))
            if (others.isEmpty()) Quiet(tl("No courses are open to join right now.")) else Paged(others, "others") { card(it) }
        }
    }
}
